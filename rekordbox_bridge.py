#!/usr/bin/env python3
"""
Rekordbox Database Bridge
Provides interface between Electron app and pyrekordbox library
"""

import sys
import json
import os
import shutil
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

# Add pyrekordbox to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'pyrekordbox-0.4.4'))

try:
    from pyrekordbox import Rekordbox6Database, RekordboxXml, show_config, update_config
    from pyrekordbox.config import __config__ as pyrekordbox_config, get_config
    from pyrekordbox.utils import get_rekordbox_pid
    from pyrekordbox.db6.smartlist import SmartList, Property, Operator
    from pyrekordbox.db6.tables import PlaylistType, DjmdSongPlaylist
except ImportError as e:
    print(json.dumps({"success": False, "error": f"Failed to import pyrekordbox: {str(e)}"}))
    sys.exit(1)


class RekordboxBridge:
    """Bridge between Electron app and pyrekordbox"""
    
    def __init__(self):
        self.db = None
        self.config = None

    # -----------------------------
    # Helpers: DB safety / framing
    # -----------------------------
    @staticmethod
    def _is_corruption_error(err: Exception) -> bool:
        msg = str(err).lower()
        return (
            "database disk image is malformed" in msg
            or "disk image is malformed" in msg
            or "malformed" in msg
            or "sqlcipher3.dbapi2.databaseerror" in msg and "malformed" in msg
        )

    def _safe_rollback(self) -> None:
        try:
            if self.db:
                self.db.rollback()
        except Exception:
            pass

    def _safe_commit(self, *, autoinc: bool = True) -> Optional[str]:
        """Commit and return error string if failed."""
        try:
            if not self.db:
                return "Database not open"
            self.db.commit(autoinc=autoinc)
            return None
        except Exception as e:
            self._safe_rollback()
            return str(e)

    def _stage_delete_track(self, content) -> None:
        """Stage deletion of a track and its playlist links (no commit)."""
        # Delete join rows first
        playlist_entries = self.db.query(DjmdSongPlaylist).filter(
            DjmdSongPlaylist.ContentID == content.ID
        ).all()
        for entry in playlist_entries:
            # Use pyrekordbox delete wrapper so registry is tracked
            self.db.delete(entry)
        self.db.delete(content)
        
    def get_config(self) -> Dict[str, Any]:
        """Get current pyrekordbox configuration"""
        try:
            # Ensure config is populated
            if not pyrekordbox_config.get("pioneer"):
                update_config()
            
            pioneer_config = pyrekordbox_config.get("pioneer", {})
            rb6_config = pyrekordbox_config.get("rekordbox6", {})
            rb7_config = pyrekordbox_config.get("rekordbox7", {})
            
            # Try to get database path from config
            db_path = None
            if rb7_config.get("db_path"):
                db_path = str(rb7_config["db_path"])
            elif rb6_config.get("db_path"):
                db_path = str(rb6_config["db_path"])
            
            return {
                "success": True,
                "config": {
                    "install_dir": str(pioneer_config.get("install_dir", "")) if pioneer_config.get("install_dir") else None,
                    "app_dir": str(pioneer_config.get("app_dir", "")) if pioneer_config.get("app_dir") else None,
                    "db_path": db_path,
                }
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def set_config(self, install_dir: Optional[str] = None, app_dir: Optional[str] = None) -> Dict[str, Any]:
        """Update pyrekordbox configuration"""
        try:
            if install_dir and app_dir:
                update_config(install_dir, app_dir)
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def open_database(self, db_path: Optional[str] = None) -> Dict[str, Any]:
        """Open Rekordbox 6/7 database"""
        try:
            actual_path = None
            if db_path:
                # Verify the path exists
                if not os.path.exists(db_path):
                    return {
                        "success": False,
                        "error": f"Database file not found: {db_path}"
                    }
                actual_path = os.path.abspath(db_path)
                print(f"Opening database from provided path: {actual_path}", file=sys.stderr)
                # Rekordbox6Database uses 'path' parameter, not 'db_path'
                self.db = Rekordbox6Database(path=db_path)
            else:
                print("Opening database using auto-detection...", file=sys.stderr)
                try:
                    self.db = Rekordbox6Database()
                    # Get the actual path that was used
                    try:
                        if hasattr(self.db, 'engine') and self.db.engine:
                            url = str(self.db.engine.url)
                            if 'sqlite' in url and ':///' in url:
                                parts = url.split(':///')
                                if len(parts) > 1:
                                    actual_path = parts[1].split('?')[0]
                                    actual_path = os.path.abspath(actual_path)
                    except:
                        pass
                except Exception as auto_error:
                    # Auto-detection failed - provide helpful error message
                    error_msg = str(auto_error)
                    
                    # Check common locations
                    common_paths = []
                    home_dir = os.path.expanduser("~")
                    
                    # macOS common locations
                    if sys.platform == "darwin":
                        common_paths = [
                            os.path.join(home_dir, "Library", "Pioneer", "rekordbox", "master.db"),
                            os.path.join(home_dir, "Library", "Pioneer", "rekordbox", "datafile.edb"),
                            "/Applications/Pioneer/rekordbox 6/master.db",
                            "/Applications/Pioneer/rekordbox 7/master.db",
                        ]
                    # Windows common locations
                    elif sys.platform == "win32":
                        appdata = os.environ.get("APPDATA", "")
                        if appdata:
                            common_paths = [
                                os.path.join(appdata, "Pioneer", "rekordbox", "master.db"),
                                os.path.join(appdata, "Pioneer", "rekordbox", "datafile.edb"),
                            ]
                    
                    # Check if any common paths exist
                    found_paths = [p for p in common_paths if os.path.exists(p)]
                    
                    suggestion = ""
                    if found_paths:
                        suggestion = f"\n\nFound database at: {found_paths[0]}\nPlease use 'Browse' to select this file manually."
                    else:
                        suggestion = "\n\nCommon locations to check:\n"
                        for path in common_paths:
                            suggestion += f"  - {path}\n"
                        suggestion += "\nPlease use 'Browse' to manually select your master.db file."
                    
                    return {
                        "success": False,
                        "error": f"Failed to open database: {error_msg}{suggestion}"
                    }
            
            # Verify database file exists and get its info
            if actual_path:
                if os.path.exists(actual_path):
                    file_size = os.path.getsize(actual_path)
                    print(f"✓ Database opened: {actual_path}", file=sys.stderr)
                    print(f"  File size: {file_size:,} bytes ({file_size / (1024*1024):.2f} MB)", file=sys.stderr)
                    # Verify it's actually a master.db file
                    if actual_path.endswith('master.db'):
                        print(f"  ✓ Confirmed: This is a master.db file", file=sys.stderr)
                    else:
                        print(f"  ⚠ Warning: File name is not 'master.db'", file=sys.stderr)
                else:
                    print(f"  ⚠ Warning: Database path does not exist: {actual_path}", file=sys.stderr)
            
            return {
                "success": True,
                "message": "Database opened successfully",
                "db_path": actual_path
            }
        except Exception as e:
            import traceback
            traceback.print_exc(file=sys.stderr)
            error_msg = str(e)
            
            # Provide helpful suggestions if auto-detection failed
            if "No Rekordbox" in error_msg or "directory found" in error_msg:
                home_dir = os.path.expanduser("~")
                if sys.platform == "darwin":
                    common_db = os.path.join(home_dir, "Library", "Pioneer", "rekordbox", "master.db")
                    if os.path.exists(common_db):
                        error_msg += f"\n\nFound database at: {common_db}\nPlease use 'Browse' to select this file."
                    else:
                        error_msg += f"\n\nCommon locations to check:\n  - {common_db}\n  - ~/Library/Pioneer/rekordbox/datafile.edb\n\nPlease use 'Browse' to manually select your master.db file."
            
            return {
                "success": False,
                "error": f"Failed to open database: {error_msg}"
            }
    
    def close_database(self) -> Dict[str, Any]:
        """Close the database connection"""
        try:
            if self.db:
                self.db.close()
                self.db = None
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def backup_database(self, db_path: Optional[str] = None) -> Dict[str, Any]:
        """Backup the Rekordbox database file with rotation (keeps 3 backups)"""
        try:
            actual_db_path = None

            if db_path:
                # Verify the path exists
                if not os.path.exists(db_path):
                    return {
                        "success": False,
                        "error": f"Database file not found: {db_path}"
                    }
                actual_db_path = os.path.abspath(db_path)
            else:
                # Auto-detect database path like import function does
                print("Auto-detecting database for backup...", file=sys.stderr)
                try:
                    # Temporarily open database to get path
                    temp_db = Rekordbox6Database()

                    # Get the actual path that was used
                    if hasattr(temp_db, 'engine') and temp_db.engine:
                        url = str(temp_db.engine.url)

                        # Extract database path from SQLAlchemy URL
                        # URL format: sqlite+pysqlcipher://:***@//Users/suhaas/Library/Pioneer/rekordbox/master.db
                        if '@' in url:
                            # Split on @ and take the part after it
                            path_part = url.split('@', 1)[1].split('?')[0]

                            # Handle double slash at start (remove one)
                            if path_part.startswith('//'):
                                path_part = path_part[1:]

                            actual_db_path = os.path.abspath(path_part)

                    temp_db.close()

                except Exception as e:
                    return {
                        "success": False,
                        "error": f"Failed to auto-detect database: {str(e)}"
                    }

            if not actual_db_path or not os.path.exists(actual_db_path):
                return {
                    "success": False,
                    "error": f"Database file not found: {actual_db_path}"
                }
            
            # Create backup directory next to the database file
            db_dir = os.path.dirname(actual_db_path)
            backup_dir = os.path.join(db_dir, "bonk_backups")

            # Create backup directory if it doesn't exist
            os.makedirs(backup_dir, exist_ok=True)

            # Generate backup filename with timestamp
            db_filename = os.path.basename(actual_db_path)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_filename = f"{db_filename}.backup_{timestamp}"
            backup_path = os.path.join(backup_dir, backup_filename)

            # Copy the database file
            print(f"Creating backup: {backup_path}", file=sys.stderr)
            shutil.copy2(actual_db_path, backup_path)
            
            # Get all backup files for this database
            backup_pattern = f"{db_filename}.backup_*"
            existing_backups = []
            for file in os.listdir(backup_dir):
                if file.startswith(f"{db_filename}.backup_"):
                    backup_file_path = os.path.join(backup_dir, file)
                    # Get modification time for sorting
                    mtime = os.path.getmtime(backup_file_path)
                    existing_backups.append((mtime, backup_file_path, file))
            
            # Sort by modification time (oldest first)
            existing_backups.sort(key=lambda x: x[0])
            
            # Keep only the 3 most recent backups (delete older ones)
            max_backups = 3
            if len(existing_backups) > max_backups:
                backups_to_delete = existing_backups[:-max_backups]  # All except the last 3
                for _, backup_path_to_delete, backup_name in backups_to_delete:
                    try:
                        os.remove(backup_path_to_delete)
                        print(f"Deleted old backup: {backup_name}", file=sys.stderr)
                    except Exception as e:
                        print(f"Warning: Could not delete old backup {backup_name}: {e}", file=sys.stderr)
            
            remaining_backups = len([f for f in os.listdir(backup_dir) if f.startswith(f"{db_filename}.backup_")])
            print(f"✓ Backup created. Total backups: {remaining_backups}", file=sys.stderr)
            
            return {
                "success": True,
                "backup_path": backup_path,
                "backup_count": remaining_backups
            }
        except Exception as e:
            import traceback
            traceback.print_exc(file=sys.stderr)
            return {
                "success": False,
                "error": f"Failed to backup database: {str(e)}"
            }
    
    def check_database_integrity(self) -> Dict[str, Any]:
        """Check database integrity using SQLite PRAGMA integrity_check"""
        try:
            if not self.db:
                return {
                    "success": False,
                    "error": "Database not open"
                }
            
            # Get raw connection to run PRAGMA commands
            connection = self.db.engine.raw_connection()
            cursor = connection.cursor()
            
            # Run integrity check
            cursor.execute("PRAGMA integrity_check")
            result = cursor.fetchone()
            
            cursor.close()
            connection.close()
            
            integrity_ok = result and result[0] == "ok"
            message = result[0] if result else "Unknown integrity status"
            
            # Provide more helpful error messages for common corruption types
            if not integrity_ok:
                if "index" in message.lower() and "wrong" in message.lower():
                    message += "\n\nThis indicates index corruption. The repair function will rebuild all indexes to fix this issue."
                elif "malformed" in message.lower() or "corrupt" in message.lower():
                    message += "\n\nThis indicates database file corruption. The repair function will attempt to fix this using VACUUM."
            
            return {
                "success": True,
                "integrity_ok": integrity_ok,
                "message": message
            }
        except Exception as e:
            import traceback
            traceback.print_exc(file=sys.stderr)
            return {
                "success": False,
                "error": f"Failed to check database integrity: {str(e)}"
            }
    
    def repair_database(self) -> Dict[str, Any]:
        """Attempt to repair database using SQLite VACUUM"""
        db_path = None
        try:
            if not self.db:
                return {
                    "success": False,
                    "error": "Database not open"
                }
            
            # Check if Rekordbox is running
            pid = get_rekordbox_pid()
            if pid:
                return {
                    "success": False,
                    "error": "Rekordbox is running. Please close Rekordbox before repairing the database."
                }
            
            # Get the database path before closing
            if hasattr(self.db, 'engine') and self.db.engine:
                url = str(self.db.engine.url)
                if 'sqlite' in url:
                    # Handle both encrypted and unencrypted URLs
                    if '@' in url:
                        # Encrypted: sqlite+pysqlcipher://:***@/path/to/db
                        path_part = url.split('@', 1)[1].split('?')[0]
                        if path_part.startswith('//'):
                            path_part = path_part[1:]
                        db_path = os.path.abspath(path_part)
                    elif ':///' in url:
                        # Unencrypted: sqlite:///path/to/db
                        parts = url.split(':///')
                        if len(parts) > 1:
                            db_path = parts[1].split('?')[0]
                            db_path = os.path.abspath(db_path)
            
            if not db_path or not os.path.exists(db_path):
                return {
                    "success": False,
                    "error": "Could not determine database path"
                }
            
            # Close the database connection first
            self.db.close()
            
            # Create a backup before repair
            backup_result = self.backup_database(db_path)
            if not backup_result.get("success"):
                print(f"Warning: Could not create backup before repair: {backup_result.get('error')}", file=sys.stderr)
            
            # Reopen database to get connection
            self.db = Rekordbox6Database(path=db_path)
            
            # Get connection for repair operations
            connection = self.db.engine.raw_connection()
            cursor = connection.cursor()
            
            # First, rebuild all indexes to fix index corruption
            print("Step 1: Rebuilding indexes to fix index corruption...", file=sys.stderr)
            try:
                cursor.execute("REINDEX")
                print("✓ Indexes rebuilt successfully", file=sys.stderr)
            except Exception as e:
                print(f"Warning: REINDEX failed: {e}", file=sys.stderr)
                # Continue with VACUUM anyway
            
            # Then run VACUUM to repair and compact the database
            print("Step 2: Running VACUUM to repair and compact database...", file=sys.stderr)
            cursor.execute("VACUUM")
            print("✓ VACUUM completed successfully", file=sys.stderr)
            
            cursor.close()
            connection.close()
            
            # Close and reopen to verify
            self.db.close()
            self.db = Rekordbox6Database(path=db_path)
            
            # Check integrity after repair
            integrity_result = self.check_database_integrity()
            
            if integrity_result.get("integrity_ok"):
                return {
                    "success": True,
                    "message": "Database repaired successfully",
                    "integrity_ok": True
                }
            else:
                return {
                    "success": False,
                    "error": f"Database repair completed but integrity check failed: {integrity_result.get('message')}",
                    "integrity_ok": False
                }
        except Exception as e:
            import traceback
            traceback.print_exc(file=sys.stderr)
            # Try to reopen database
            try:
                if db_path and os.path.exists(db_path):
                    self.db = Rekordbox6Database(path=db_path)
            except:
                pass
            return {
                "success": False,
                "error": f"Failed to repair database: {str(e)}"
            }
    
    def import_from_database(self, db_path: Optional[str] = None) -> Dict[str, Any]:
        """Import tracks and playlists from Rekordbox database"""
        try:
            # Open database if not already open
            if not self.db:
                result = self.open_database(db_path)
                if not result["success"]:
                    return result
                actual_db_path = result.get("db_path")
                if actual_db_path:
                    print(f"Importing from database: {actual_db_path}", file=sys.stderr)
            
            # Get all tracks
            tracks = []
            for content in self.db.get_content():
                # Safely get key name
                try:
                    key_name = content.KeyName if content.Key else ""
                except:
                    key_name = ""
                
                # Safely get remixer name
                try:
                    remixer_name = content.RemixerName if content.Remixer else ""
                except:
                    remixer_name = ""
                
                # Rekordbox stores BPM multiplied by 100 (e.g., 128.5 BPM = 12850)
                # Convert back to normal BPM by dividing by 100
                bpm_value = None
                if content.BPM is not None:
                    bpm_value = content.BPM / 100.0
                
                # Collect MyTag names if available
                try:
                    raw_mytags = list(content.MyTagNames) if hasattr(content, "MyTagNames") else []
                except Exception:
                    raw_mytags = []

                # Parse MyTags into category + name using Rekordbox's four buckets
                # Expected format: "Category: Name" where Category is one of Genre/Components/Situation/Custom
                allowed_categories = {"Genre", "Components", "Situation", "Custom"}
                tags = []
                for mt in raw_mytags:
                    if not mt:
                        continue
                    if ":" in mt:
                        cat, val = mt.split(":", 1)
                        cat = cat.strip()
                        val = val.strip()
                        if cat in allowed_categories and val:
                            tags.append({"category": cat, "name": val, "source": "rekordbox"})
                            continue
                    # Fallback: unknown format, treat as Custom with full string
                    tags.append({"category": "Custom", "name": mt.strip(), "source": "rekordbox"})

                # Safely get composer name
                try:
                    composer_name = content.ComposerName if content.Composer else ""
                except:
                    composer_name = ""
                
                # Safely get album artist name
                try:
                    album_artist_name = content.AlbumArtistName if content.Album else ""
                except:
                    album_artist_name = ""
                
                # Safely get lyricist name (Lyricist is a ForeignKey to DjmdArtist)
                try:
                    if content.Lyricist:
                        lyricist_artist = self.db.get_artist(ID=content.Lyricist)
                        lyricist_name = lyricist_artist.Name if lyricist_artist else ""
                    else:
                        lyricist_name = ""
                except:
                    lyricist_name = ""
                
                # Safely get original artist name
                try:
                    original_artist_name = content.OrgArtistName if content.OrgArtist else ""
                except:
                    original_artist_name = ""

                track = {
                    "TrackID": str(content.ID),
                    "Name": content.Title or "",
                    "Artist": content.ArtistName or "",
                    "Album": content.AlbumName or "",
                    "Genre": content.GenreName or "",
                    "Year": str(content.ReleaseYear) if content.ReleaseYear else "",
                    "AverageBpm": str(bpm_value) if bpm_value is not None else "",
                    "TotalTime": str(int(content.Length * 1000)) if content.Length else "",
                    "BitRate": str(content.BitRate) if content.BitRate else "",
                    "SampleRate": str(content.SampleRate) if content.SampleRate else "",
                    "Comments": content.Commnt or "",
                    "Rating": str(content.Rating) if content.Rating else "",
                    "Location": f"file://localhost{content.FolderPath}",
                    "Tonality": key_name,
                    "Key": key_name,
                    "Label": content.LabelName or "",
                    "Remixer": remixer_name,
                    "Composer": composer_name,
                    "AlbumArtist": album_artist_name,
                    "TrackNumber": str(content.TrackNo) if content.TrackNo is not None else "",
                    "DiscNumber": str(content.DiscNo) if content.DiscNo is not None else "",
                    "Lyricist": lyricist_name,
                    "OriginalArtist": original_artist_name,
                    "MixName": content.Subtitle or "",  # Subtitle field stores Mix Name
                    "Mix": content.Subtitle or "",  # Keep Mix for backward compatibility
                    "DateAdded": content.created_at.isoformat() if content.created_at else "",
                    "PlayCount": str(content.DJPlayCount) if content.DJPlayCount else "",
                    "Color": str(content.ColorID) if content.ColorID else "",
                    "tags": tags,
                }
                tracks.append(track)
            
            # Get all playlists
            playlists = []
            print(f"Fetching playlists...", file=sys.stderr)
            all_playlists = list(self.db.get_playlist())
            print(f"Found {len(all_playlists)} playlists", file=sys.stderr)
            
            # Only get root-level playlists (those without a parent)
            for playlist in all_playlists:
                if not playlist.ParentID or playlist.ParentID == "root":
                    pl_data = self._parse_playlist(playlist)
                    if pl_data:
                        playlists.append(pl_data)
                        print(f"Added playlist: {pl_data['Name']} (Type: {pl_data['Type']})", file=sys.stderr)
            
            print(f"Total root playlists: {len(playlists)}", file=sys.stderr)
            
            # Get the actual database path for the response
            actual_db_path = None
            try:
                if hasattr(self.db, 'engine') and self.db.engine:
                    url = str(self.db.engine.url)
                    if 'sqlite' in url and ':///' in url:
                        parts = url.split(':///')
                        if len(parts) > 1:
                            actual_db_path = os.path.abspath(parts[1].split('?')[0])
            except:
                pass
            
            return {
                "success": True,
                "library": {
                    "tracks": tracks,
                    "playlists": playlists
                },
                "trackCount": len(tracks),
                "playlistCount": len(playlists),
                "db_path": actual_db_path
            }
        
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to import from database: {str(e)}"
            }
    
    def _parse_playlist(self, playlist) -> Optional[Dict[str, Any]]:
        """Parse a playlist object from the database"""
        try:
            # Determine type first to know how to get contents
            try:
                is_folder = playlist.is_folder
                is_smart = playlist.is_smart_playlist
            except Exception as e:
                print(f"  Warning: Could not determine playlist type, using Attribute: {e}", file=sys.stderr)
                # Fallback: check Attribute directly
                is_folder = getattr(playlist, 'Attribute', PlaylistType.PLAYLIST) == PlaylistType.FOLDER
                is_smart = getattr(playlist, 'Attribute', PlaylistType.PLAYLIST) == PlaylistType.SMART_PLAYLIST
            
            # Get track IDs in playlist
            track_ids = []
            if is_smart:
                # For smart playlists, use get_playlist_contents to evaluate the smart list
                try:
                    contents = list(self.db.get_playlist_contents(playlist))
                    for content in contents:
                        track_ids.append(str(content.ID))
                    print(f"  Smart playlist '{playlist.Name}' has {len(track_ids)} matching tracks", file=sys.stderr)
                except Exception as e:
                    print(f"  Warning: Failed to get smart playlist contents: {e}", file=sys.stderr)
                    import traceback
                    traceback.print_exc(file=sys.stderr)
            else:
                # For regular playlists, get tracks from Songs relationship
                try:
                    if hasattr(playlist, 'Songs') and playlist.Songs:
                        for song in playlist.Songs:
                            try:
                                if song.Content:
                                    track_ids.append(str(song.Content.ID))
                            except Exception as e:
                                print(f"  Warning: Failed to get content for song: {e}", file=sys.stderr)
                except Exception as e:
                    print(f"  Warning: Failed to get songs: {e}", file=sys.stderr)
            
            # Get child playlists
            children = []
            try:
                if hasattr(playlist, 'Children') and playlist.Children:
                    for child in playlist.Children:
                        child_data = self._parse_playlist(child)
                        if child_data:
                            children.append(child_data)
            except Exception as e:
                print(f"  Warning: Failed to get children: {e}", file=sys.stderr)
            
            playlist_type = "0" if is_folder else ("2" if is_smart else "1")  # 0 = folder, 1 = playlist, 2 = smart
            
            result = {
                "Name": playlist.Name or "Unnamed",
                "Type": playlist_type,
                "KeyType": "TrackID",
                "Entries": track_ids,
                "Children": children
            }
            
            # Extract smart playlist conditions if it's a smart playlist
            if is_smart and hasattr(playlist, 'SmartList') and playlist.SmartList:
                try:
                    from pyrekordbox.db6.smartlist import SmartList
                    smart_list = SmartList()
                    smart_list.parse(playlist.SmartList)
                    
                    # Convert conditions to Bonk format
                    conditions = []
                    for cond in smart_list.conditions:
                        # Map operator from int to string
                        operator_map = {
                            1: "EQUAL", 2: "NOT_EQUAL", 3: "GREATER", 4: "LESS",
                            5: "IN_RANGE", 6: "IN_LAST", 7: "NOT_IN_LAST",
                            8: "CONTAINS", 9: "NOT_CONTAINS", 10: "STARTS_WITH", 11: "ENDS_WITH"
                        }
                        operator_str = operator_map.get(cond.operator, "EQUAL")
                        
                        condition = {
                            "property": cond.property,
                            "operator": operator_str,
                            "value_left": str(cond.value_left) if cond.value_left is not None else "",
                            "value_right": str(cond.value_right) if cond.value_right is not None else None
                        }
                        conditions.append(condition)
                    
                    result["conditions"] = conditions
                    result["logicalOperator"] = smart_list.logical_operator
                    print(f"  Extracted {len(conditions)} conditions for smart playlist", file=sys.stderr)
                except Exception as e:
                    print(f"  Warning: Failed to parse smart playlist conditions: {e}", file=sys.stderr)
                    import traceback
                    traceback.print_exc(file=sys.stderr)
            
            print(f"  Parsed: {result['Name']} - Type: {result['Type']}, Tracks: {len(track_ids)}, Children: {len(children)}", file=sys.stderr)
            return result
            
        except Exception as e:
            print(f"Warning: Failed to parse playlist: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            return None
    
    def export_to_database(self, tracks: List[Dict], playlists: List[Dict], 
                          db_path: Optional[str] = None, sync_mode: str = "overwrite") -> Dict[str, Any]:
        """Export tracks and playlists to Rekordbox database"""
        try:
            # Check if Rekordbox is running - commit will fail if it is
            try:
                pid = get_rekordbox_pid()
                if pid:
                    return {
                        "success": False,
                        "error": "Rekordbox is currently running. Please close Rekordbox completely before exporting changes. Changes cannot be saved while Rekordbox is open."
                    }
            except Exception as e:
                # If we can't check, continue anyway (might not be installed)
                print(f"Could not check if Rekordbox is running: {e}", file=sys.stderr)
            # Determine actual database path being used
            actual_db_path = db_path
            if not actual_db_path:
                # Try to get from config
                config_result = self.get_config()
                if config_result.get("success") and config_result.get("config", {}).get("db_path"):
                    actual_db_path = config_result["config"]["db_path"]
                else:
                    # If no path specified, pyrekordbox will use default
                    # We can get it from the database after opening
                    actual_db_path = "Auto-detected (default Rekordbox database)"
            
            # Open database if not already open
            if not self.db:
                result = self.open_database(db_path)
                if not result["success"]:
                    return result
                
                # Get actual path from opened database
                opened_path = result.get("db_path")
                if opened_path:
                    actual_db_path = opened_path
                    print(f"Exporting to database: {actual_db_path}", file=sys.stderr)
                elif not actual_db_path or actual_db_path == "Auto-detected (default Rekordbox database)":
                    try:
                        # Try to get from config again after opening
                        config_result = self.get_config()
                        if config_result.get("success") and config_result.get("config", {}).get("db_path"):
                            actual_db_path = config_result["config"]["db_path"]
                        elif hasattr(self.db, 'engine') and self.db.engine:
                            # Get from SQLAlchemy engine URL
                            url = str(self.db.engine.url)
                            # Handle both sqlite:/// and sqlite+pysqlcipher:// formats
                            if 'sqlite' in url:
                                # Extract path from URL - format is usually sqlite:///path or sqlite+pysqlcipher://:key@/path
                                if ':///' in url:
                                    parts = url.split(':///')
                                    if len(parts) > 1:
                                        path_part = parts[1].split('?')[0]  # Remove query params
                                        actual_db_path = os.path.abspath(path_part)
                    except Exception as e:
                        print(f"Could not determine database path: {e}", file=sys.stderr)
                        # Fallback: try to get from config one more time
                        try:
                            rb6_config = pyrekordbox_config.get("rekordbox6", {})
                            rb7_config = pyrekordbox_config.get("rekordbox7", {})
                            if rb7_config.get("db_path"):
                                actual_db_path = os.path.abspath(str(rb7_config["db_path"]))
                            elif rb6_config.get("db_path"):
                                actual_db_path = os.path.abspath(str(rb6_config["db_path"]))
                        except:
                            pass
            
            # Ensure generated IDs are strings to avoid "Could not sort objects by primary key;
            # '<' not supported between str and int" (Rekordbox 7 has mixed int/str PKs)
            _orig_gen = self.db.generate_unused_id
            def _gen_str(*a, **kw):
                return str(_orig_gen(*a, **kw))
            self.db.generate_unused_id = _gen_str

            # PRE-FLIGHT CHECK: Verify database integrity before making any changes
            print("Step 2: Checking database integrity...", file=sys.stderr)
            try:
                # Test database accessibility by querying a critical table
                # This will fail immediately if database is corrupted
                test_query = self.db.get_content().limit(1).all()
                # Also test the problematic playlist table
                from pyrekordbox.db6.tables import DjmdSongPlaylist
                test_playlist = self.db.query(DjmdSongPlaylist).limit(1).all()
                print("  ✓ Database integrity check passed", file=sys.stderr)
            except Exception as integrity_error:
                error_msg = str(integrity_error)
                if "malformed" in error_msg.lower() or "corrupt" in error_msg.lower() or "disk image" in error_msg.lower():
                    return {
                        "success": False,
                        "error": f"❌ DATABASE IS CORRUPTED: {error_msg}\n\nThe database cannot be safely modified. You must restore from a clean backup first.\n\nRun: cp /Users/suhaas/Documents/rekordbox_bak_YYYYMMDD/master.db ~/Library/Pioneer/rekordbox/master.db"
                    }
                # If it's not a corruption error, just warn and continue
                print(f"  ⚠ Could not check database integrity: {error_msg}", file=sys.stderr)
            
            added_count = 0
            updated_count = 0
            skipped_count = 0
            deleted_count = 0
            errors = []
            
            # Create a map of existing tracks by file path
            # Normalize paths for matching (handle case-insensitive on macOS/Windows)
            existing_tracks = {}
            existing_tracks_normalized = {}  # For case-insensitive matching
            for content in self.db.get_content():
                path = content.FolderPath
                existing_tracks[path] = content
                # Also store normalized version for matching
                normalized_path = path.replace("\\", "/").lower() if path else ""
                if normalized_path:
                    existing_tracks_normalized[normalized_path] = content
            
            print(f"Step 3: Processing tracks...", file=sys.stderr)
            print(f"  Found {len(existing_tracks)} existing tracks in database", file=sys.stderr)
            print(f"  Processing {len(tracks)} tracks from Bonk", file=sys.stderr)
            print(f"  Sync mode: {sync_mode}", file=sys.stderr)
            
            # Helper function to normalize paths for comparison
            def normalize_path_for_comparison(path: str) -> str:
                """Normalize path for comparison - handles URL encoding, case, separators"""
                if not path:
                    return ""
                # Remove file:// prefixes
                path = path.replace("file://localhost", "").replace("file://", "")
                # URL decode
                import urllib.parse
                try:
                    path = urllib.parse.unquote(path)
                except:
                    pass
                # Normalize separators and case
                path = path.replace("\\", "/")
                # Remove leading/trailing slashes for comparison
                path = path.strip("/")
                return path.lower()
            
            # Create a set of normalized Bonk track paths for deletion detection
            bonk_track_paths_normalized = set()
            for track in tracks:
                location = track.get("Location", "")
                normalized = normalize_path_for_comparison(location)
                if normalized:
                    bonk_track_paths_normalized.add(normalized)
            
            # Helper function to get or create artist
            def get_or_create_artist(name: str):
                if not name:
                    return None
                try:
                    artist = self.db.get_artist(Name=name).one_or_none()
                    if not artist:
                        # Create new artist
                        artist = self.db.add_artist(name=name, search_str=name.upper())
                    return artist
                except ValueError:
                    # Artist already exists, get it
                    return self.db.get_artist(Name=name).one()
                except Exception as e:
                    print(f"Error getting/creating artist '{name}': {e}", file=sys.stderr)
                    return None
            
            # Helper function to get or create genre
            def get_or_create_genre(name: str):
                if not name:
                    return None
                try:
                    genre = self.db.get_genre(Name=name).one_or_none()
                    if not genre:
                        # Create new genre
                        genre = self.db.add_genre(name=name)
                    return genre
                except ValueError:
                    # Genre already exists, get it
                    return self.db.get_genre(Name=name).one()
                except Exception as e:
                    print(f"Error getting/creating genre '{name}': {e}", file=sys.stderr)
                    return None
            
            # Helper function to get or create key
            def get_or_create_key(key_name: str):
                if not key_name:
                    return None
                try:
                    key = self.db.get_key(ScaleName=key_name).one_or_none()
                    if not key:
                        # Create new key - this is more complex, skip for now
                        return None
                    return key
                except Exception as e:
                    print(f"Error getting key '{key_name}': {e}", file=sys.stderr)
                    return None
            
            # Helper function to get or create label
            def get_or_create_label(name: str):
                if not name:
                    return None
                try:
                    label = self.db.get_label(Name=name).one_or_none()
                    if not label:
                        # Create new label
                        label = self.db.add_label(name=name)
                    return label
                except ValueError:
                    # Label already exists, get it
                    return self.db.get_label(Name=name).one()
                except Exception as e:
                    print(f"Error getting/creating label '{name}': {e}", file=sys.stderr)
                    return None
            
            # Process tracks
            debug_count = 0
            for idx, track in enumerate(tracks):
                try:
                    # Parse location
                    location = track.get("Location", "")
                    if location.startswith("file://localhost"):
                        location = location.replace("file://localhost", "")
                    elif location.startswith("file://"):
                        location = location.replace("file://", "")
                    
                    # URL decode the path
                    import urllib.parse
                    try:
                        location = urllib.parse.unquote(location)
                    except:
                        pass
                    
                    # Normalize path separators
                    location_normalized = location.replace("\\", "/") if location else ""
                    location_normalized_lower = location_normalized.lower() if location_normalized else ""
                    
                    if not location:
                        skipped_count += 1
                        continue
                    
                    # Check if track exists - try exact match first, then normalized
                    existing = existing_tracks.get(location)
                    if not existing and location_normalized:
                        existing = existing_tracks.get(location_normalized)
                    if not existing and location_normalized_lower:
                        existing = existing_tracks_normalized.get(location_normalized_lower)
                    
                    # Debug: log first few tracks to understand matching
                    if debug_count < 3:
                        print(f"Track #{idx+1}: {track.get('Name', 'unknown')[:40]}", file=sys.stderr)
                        print(f"  Location: {location[:100] if location else 'NONE'}", file=sys.stderr)
                        print(f"  Normalized: {location_normalized_lower[:100] if location_normalized_lower else 'NONE'}", file=sys.stderr)
                        print(f"  Found in DB: {existing is not None}", file=sys.stderr)
                        if existing:
                            print(f"  DB Title: {existing.Title[:40] if existing.Title else 'NONE'}", file=sys.stderr)
                            print(f"  DB Path: {existing.FolderPath[:100] if existing.FolderPath else 'NONE'}", file=sys.stderr)
                        debug_count += 1
                    
                    if existing:
                        # Update existing track
                        # Only update if sync_mode allows it
                        if sync_mode == "merge_only":
                            skipped_count += 1
                            continue
                        
                        track_updated = False
                        
                        # Debug: log first few comparisons
                        if updated_count == 0 and skipped_count < 3:
                            print(f"Comparing track #{idx+1}: {track.get('Name', 'unknown')[:40]}", file=sys.stderr)
                            print(f"  Bonk Name: '{track.get('Name')}' vs DB Title: '{existing.Title}'", file=sys.stderr)
                            print(f"  Bonk Artist: '{track.get('Artist')}' vs DB Artist: '{existing.ArtistName if existing.Artist else None}'", file=sys.stderr)
                            print(f"  Bonk Rating: '{track.get('Rating')}' vs DB Rating: '{existing.Rating}'", file=sys.stderr)
                            print(f"  Bonk Comments: '{track.get('Comments')}' vs DB Comments: '{existing.Commnt}'", file=sys.stderr)
                        
                        # Update basic fields - always update if value is provided (even if empty)
                        new_name = track.get("Name")
                        if new_name is not None:
                            existing_title = existing.Title or ""
                            if str(new_name) != str(existing_title):
                                existing.Title = str(new_name)
                                track_updated = True
                                if updated_count < 3:
                                    print(f"  -> Title updated: '{existing_title}' -> '{new_name}'", file=sys.stderr)
                        
                        if track.get("Comments") is not None:
                            new_comments = str(track["Comments"]) if track["Comments"] else ""
                            existing_comments = existing.Commnt or ""
                            if new_comments != existing_comments:
                                existing.Commnt = new_comments
                                track_updated = True
                        
                        if track.get("Rating") is not None:
                            try:
                                new_rating = int(track["Rating"]) if track["Rating"] else 0
                                existing_rating = existing.Rating or 0
                                if new_rating != existing_rating:
                                    existing.Rating = new_rating
                                    track_updated = True
                            except (ValueError, TypeError):
                                pass
                        
                        if track.get("Year") is not None:
                            try:
                                new_year = int(track["Year"]) if track["Year"] else None
                                existing_year = existing.ReleaseYear
                                if new_year != existing_year:
                                    existing.ReleaseYear = new_year
                                    track_updated = True
                            except (ValueError, TypeError):
                                pass
                        
                        # Update BPM
                        # Rekordbox stores BPM multiplied by 100, so multiply by 100 when saving
                        if track.get("AverageBpm") is not None:
                            try:
                                bpm_float = float(track["AverageBpm"]) if track["AverageBpm"] else None
                                if bpm_float is not None:
                                    new_bpm = int(bpm_float * 100)  # Multiply by 100 for Rekordbox format
                                    existing_bpm = existing.BPM
                                    if new_bpm != existing_bpm:
                                        existing.BPM = new_bpm
                                        track_updated = True
                            except (ValueError, TypeError):
                                pass
                        
                        # Update artist
                        if track.get("Artist"):
                            artist = get_or_create_artist(track["Artist"])
                            if artist and existing.ArtistID != artist.ID:
                                existing.ArtistID = artist.ID
                                track_updated = True
                        
                        # Update genre
                        if track.get("Genre"):
                            genre = get_or_create_genre(track["Genre"])
                            if genre and existing.GenreID != genre.ID:
                                existing.GenreID = genre.ID
                                track_updated = True
                        
                        # Update key
                        key_name = track.get("Key") or track.get("Tonality")
                        if key_name:
                            key = get_or_create_key(key_name)
                            if key and existing.KeyID != key.ID:
                                existing.KeyID = key.ID
                                track_updated = True

                        # Update Label
                        if track.get("Label") is not None:
                            new_label = str(track["Label"]) if track["Label"] else None
                            existing_label = existing.LabelName if existing.Label else None
                            if new_label != existing_label:
                                try:
                                    if new_label:
                                        label = get_or_create_label(new_label)
                                        if label:
                                            existing.LabelID = label.ID
                                    else:
                                        existing.LabelID = None
                                    track_updated = True
                                except Exception as e:
                                    print(f"Error updating label for track {content.ID}: {e}", file=sys.stderr)

                        # Update Remixer
                        if track.get("Remixer") is not None:
                            remixer_name = str(track["Remixer"]) if track["Remixer"] else None
                            existing_remixer = existing.RemixerName if existing.Remixer else None
                            if remixer_name != existing_remixer:
                                try:
                                    if remixer_name:
                                        remixer = get_or_create_artist(remixer_name)
                                        if remixer:
                                            existing.RemixerID = remixer.ID
                                    else:
                                        existing.RemixerID = None
                                    track_updated = True
                                except Exception as e:
                                    print(f"Error updating remixer for track {content.ID}: {e}", file=sys.stderr)

                        # Update Composer
                        if track.get("Composer") is not None:
                            composer_name = str(track["Composer"]) if track["Composer"] else None
                            existing_composer = existing.ComposerName if existing.Composer else None
                            if composer_name != existing_composer:
                                try:
                                    if composer_name:
                                        composer = get_or_create_artist(composer_name)
                                        if composer:
                                            existing.ComposerID = composer.ID
                                    else:
                                        existing.ComposerID = None
                                    track_updated = True
                                except Exception as e:
                                    print(f"Error updating composer for track {content.ID}: {e}", file=sys.stderr)

                        # Update Album Artist (via Album)
                        if track.get("AlbumArtist") is not None:
                            album_artist_name = str(track["AlbumArtist"]) if track["AlbumArtist"] else None
                            try:
                                if existing.Album:
                                    existing_album_artist = existing.AlbumArtistName if existing.Album else None
                                    if album_artist_name != existing_album_artist:
                                        if album_artist_name:
                                            album_artist = get_or_create_artist(album_artist_name)
                                            if album_artist and existing.Album:
                                                existing.Album.AlbumArtistID = album_artist.ID
                                        else:
                                            if existing.Album:
                                                existing.Album.AlbumArtistID = None
                                        track_updated = True
                            except Exception as e:
                                print(f"Error updating album artist for track {content.ID}: {e}", file=sys.stderr)

                        # Update Track Number
                        if track.get("TrackNumber") is not None:
                            try:
                                track_num = int(track["TrackNumber"]) if track["TrackNumber"] else None
                                if track_num != existing.TrackNo:
                                    existing.TrackNo = track_num
                                    track_updated = True
                            except (ValueError, TypeError):
                                pass

                        # Update Disc Number
                        if track.get("DiscNumber") is not None:
                            try:
                                disc_num = int(track["DiscNumber"]) if track["DiscNumber"] else None
                                if disc_num != existing.DiscNo:
                                    existing.DiscNo = disc_num
                                    track_updated = True
                            except (ValueError, TypeError):
                                pass

                        # Update Lyricist
                        if track.get("Lyricist") is not None:
                            lyricist_name = str(track["Lyricist"]) if track["Lyricist"] else None
                            # Get existing lyricist name
                            existing_lyricist = None
                            try:
                                if existing.Lyricist:
                                    lyricist_artist = self.db.get_artist(ID=existing.Lyricist)
                                    existing_lyricist = lyricist_artist.Name if lyricist_artist else None
                            except:
                                pass
                            if lyricist_name != existing_lyricist:
                                try:
                                    if lyricist_name:
                                        lyricist = get_or_create_artist(lyricist_name)
                                        if lyricist:
                                            existing.LyricistID = lyricist.ID
                                    else:
                                        existing.LyricistID = None
                                    track_updated = True
                                except Exception as e:
                                    print(f"Error updating lyricist for track {existing.ID}: {e}", file=sys.stderr)

                        # Update Original Artist
                        if track.get("OriginalArtist") is not None:
                            original_artist_name = str(track["OriginalArtist"]) if track["OriginalArtist"] else None
                            existing_original = existing.OrgArtistName if existing.OrgArtist else None
                            if original_artist_name != existing_original:
                                try:
                                    if original_artist_name:
                                        original_artist = get_or_create_artist(original_artist_name)
                                        if original_artist:
                                            existing.OrgArtistID = original_artist.ID
                                    else:
                                        existing.OrgArtistID = None
                                    track_updated = True
                                except Exception as e:
                                    print(f"Error updating original artist for track {content.ID}: {e}", file=sys.stderr)

                        # Update Mix Name (stored in Subtitle field)
                        if track.get("MixName") is not None:
                            mix_name = str(track["MixName"]) if track["MixName"] else None
                            existing_subtitle = existing.Subtitle or None
                            if mix_name != existing_subtitle:
                                existing.Subtitle = mix_name
                                track_updated = True

                        # Update MyTags from Bonk custom tags (map categories to Rekordbox buckets)
                        if track.get("tags") is not None:
                            try:
                                allowed_categories = {"Genre", "Components", "Situation", "Custom"}
                                tag_names = []
                                for t in track.get("tags", []):
                                    name = t.get("name")
                                    if not name:
                                        continue
                                    cat = t.get("category") or ""
                                    if cat in allowed_categories:
                                        tag_names.append(f"{cat}: {name}")
                                    else:
                                        # Fallback to Custom bucket
                                        tag_names.append(f"Custom: {name}")
                                existing.MyTagNames = tag_names
                                track_updated = True
                            except Exception as e:
                                print(f"Failed to update MyTags for track {track.get('Name')}: {e}", file=sys.stderr)
                        
                        if track_updated:
                            updated_count += 1
                        else:
                            # Track exists but no changes needed - this is fine, skip it
                            skipped_count += 1
                    else:
                        # Add new track
                        if sync_mode == "merge_only":
                            skipped_count += 1
                            continue
                        
                        try:
                            # Check if file exists
                            file_path = Path(location)
                            if not file_path.exists():
                                errors.append(f"Track {track.get('Name', 'unknown')}: File not found")
                                skipped_count += 1
                                continue
                            
                            # Prepare kwargs for add_content
                            kwargs = {}
                            if track.get("Name"):
                                kwargs["Title"] = track["Name"]
                            if track.get("Comments"):
                                kwargs["Commnt"] = str(track["Comments"])
                            if track.get("Rating"):
                                try:
                                    kwargs["Rating"] = int(track["Rating"])
                                except (ValueError, TypeError):
                                    pass
                            if track.get("Year"):
                                try:
                                    kwargs["ReleaseYear"] = int(track["Year"])
                                except (ValueError, TypeError):
                                    pass
                            if track.get("AverageBpm"):
                                try:
                                    # Rekordbox stores BPM multiplied by 100
                                    bpm_float = float(track["AverageBpm"])
                                    kwargs["BPM"] = int(bpm_float * 100)
                                except (ValueError, TypeError):
                                    pass
                            
                            # Add the track
                            new_content = self.db.add_content(location, **kwargs)
                            
                            # Set artist, genre, and key after creation
                            if track.get("Artist"):
                                artist = get_or_create_artist(track["Artist"])
                                if artist:
                                    new_content.ArtistID = artist.ID
                            
                            if track.get("Genre"):
                                genre = get_or_create_genre(track["Genre"])
                                if genre:
                                    new_content.GenreID = genre.ID
                            
                            key_name = track.get("Key") or track.get("Tonality")
                            if key_name:
                                key = get_or_create_key(key_name)
                                if key:
                                    new_content.KeyID = key.ID

                            # Apply MyTags from Bonk custom tags (map categories to Rekordbox buckets)
                            if track.get("tags"):
                                try:
                                    allowed_categories = {"Genre", "Components", "Situation", "Custom"}
                                    tag_names = []
                                    for t in track.get("tags", []):
                                        name = t.get("name")
                                        if not name:
                                            continue
                                        cat = t.get("category") or ""
                                        if cat in allowed_categories:
                                            tag_names.append(f"{cat}: {name}")
                                        else:
                                            tag_names.append(f"Custom: {name}")
                                    new_content.MyTagNames = tag_names
                                except Exception as e:
                                    print(f"Failed to set MyTags for new track {track.get('Name')}: {e}", file=sys.stderr)
                            
                            added_count += 1
                        except ValueError as e:
                            # Track already exists (shouldn't happen, but handle it)
                            if "already exists" in str(e):
                                skipped_count += 1
                            else:
                                errors.append(f"Track {track.get('Name', 'unknown')}: {str(e)}")
                                skipped_count += 1
                        except Exception as e:
                            errors.append(f"Track {track.get('Name', 'unknown')}: {str(e)}")
                            skipped_count += 1
                
                except Exception as e:
                    errors.append(f"Track {track.get('Name', 'unknown')}: {str(e)}")
                    skipped_count += 1
            
            # Step 4: Handle deletions: Remove tracks from Rekordbox that are not in Bonk library
            # Only do this for "overwrite" mode to avoid accidental deletions
            if sync_mode == "overwrite":
                print(f"Step 4: Checking for tracks to delete (overwrite mode)...", file=sys.stderr)
                print(f"Bonk library has {len(bonk_track_paths_normalized)} tracks", file=sys.stderr)
                print(f"Rekordbox database has {len(existing_tracks)} tracks", file=sys.stderr)
                tracks_to_delete = []
                
                # Check each Rekordbox track
                for db_path, content in existing_tracks.items():
                    if not db_path:
                        continue
                    
                    # Normalize the database path using the same function
                    db_path_normalized = normalize_path_for_comparison(db_path)
                    
                    # Check if this track exists in Bonk library
                    path_in_bonk = db_path_normalized in bonk_track_paths_normalized
                    
                    if not path_in_bonk:
                        tracks_to_delete.append(content)
                        if len(tracks_to_delete) <= 5:
                            print(f"  Marked for deletion: {content.Title or 'Unknown'} - DB path: {db_path[:80]}", file=sys.stderr)
                            print(f"    Normalized: {db_path_normalized[:80]}", file=sys.stderr)
                
                if tracks_to_delete:
                    print(f"Found {len(tracks_to_delete)} tracks to delete from Rekordbox", file=sys.stderr)
                    # Batched deletes with rollback-per-batch and corruption hit reporting.
                    corruption_hits = []
                    batch_size = 100

                    def chunks(items, n):
                        for i in range(0, len(items), n):
                            yield items[i : i + n]

                    remaining = list(tracks_to_delete)
                    for batch in chunks(remaining, batch_size):
                        # Stage this batch
                        try:
                            for content in batch:
                                self._stage_delete_track(content)
                            # For deletes, avoid pyrekordbox autoincrement issues in RB7
                            commit_err = self._safe_commit(autoinc=False)
                            if commit_err is None:
                                deleted_count += len(batch)
                                if deleted_count <= 3:
                                    print(f"  ✓ Deleted batch of {len(batch)} tracks (total deleted so far: {deleted_count})", file=sys.stderr)
                                continue

                            # Commit failed; if corruption, bisect to find offenders
                            if self._is_corruption_error(Exception(commit_err)):
                                print("  ⚠️  Corruption detected during batch delete; isolating offending tracks...", file=sys.stderr)
                                # rollback already performed in _safe_commit
                                for content in batch:
                                    try:
                                        self._stage_delete_track(content)
                                        single_err = self._safe_commit(autoinc=False)
                                        if single_err is None:
                                            deleted_count += 1
                                            continue
                                        if self._is_corruption_error(Exception(single_err)):
                                            corruption_hits.append({
                                                "trackTitle": getattr(content, "Title", None),
                                                "trackId": getattr(content, "ID", None),
                                                "folderPath": getattr(content, "FolderPath", None),
                                                "error": single_err,
                                            })
                                            # Ensure we are clean for next
                                            self._safe_rollback()
                                            continue
                                        # Non-corruption error
                                        errors.append(f"Failed to delete track {getattr(content, 'Title', 'unknown')}: {single_err}")
                                        self._safe_rollback()
                                    except Exception as e:
                                        if self._is_corruption_error(e):
                                            corruption_hits.append({
                                                "trackTitle": getattr(content, "Title", None),
                                                "trackId": getattr(content, "ID", None),
                                                "folderPath": getattr(content, "FolderPath", None),
                                                "error": str(e),
                                            })
                                        else:
                                            errors.append(f"Failed to delete track {getattr(content, 'Title', 'unknown')}: {str(e)}")
                                        self._safe_rollback()
                                continue

                            # Non-corruption commit error: stop and report
                            return {
                                "success": False,
                                "error": f"Failed to commit deletions: {commit_err}",
                                "added": added_count,
                                "updated": updated_count,
                                "deleted": deleted_count,
                                "skipped": skipped_count,
                                "corruption_hits": corruption_hits,
                            }

                        except Exception as e:
                            # If corruption while staging, rollback and isolate similarly
                            self._safe_rollback()
                            if self._is_corruption_error(e):
                                print("  ⚠️  Corruption detected while staging batch; isolating offending tracks...", file=sys.stderr)
                                for content in batch:
                                    try:
                                        self._stage_delete_track(content)
                                        single_err = self._safe_commit(autoinc=False)
                                        if single_err is None:
                                            deleted_count += 1
                                            continue
                                        if self._is_corruption_error(Exception(single_err)):
                                            corruption_hits.append({
                                                "trackTitle": getattr(content, "Title", None),
                                                "trackId": getattr(content, "ID", None),
                                                "folderPath": getattr(content, "FolderPath", None),
                                                "error": single_err,
                                            })
                                        else:
                                            errors.append(f"Failed to delete track {getattr(content, 'Title', 'unknown')}: {single_err}")
                                        self._safe_rollback()
                                    except Exception as e2:
                                        if self._is_corruption_error(e2):
                                            corruption_hits.append({
                                                "trackTitle": getattr(content, "Title", None),
                                                "trackId": getattr(content, "ID", None),
                                                "folderPath": getattr(content, "FolderPath", None),
                                                "error": str(e2),
                                            })
                                        else:
                                            errors.append(f"Failed to delete track {getattr(content, 'Title', 'unknown')}: {str(e2)}")
                                        self._safe_rollback()
                                continue
                            return {
                                "success": False,
                                "error": f"Failed during deletion staging: {str(e)}",
                                "added": added_count,
                                "updated": updated_count,
                                "deleted": deleted_count,
                                "skipped": skipped_count,
                                "corruption_hits": corruption_hits,
                            }

                    if corruption_hits:
                        print(f"  ⚠️  Could not delete {len(corruption_hits)} tracks due to DB corruption", file=sys.stderr)
                        # Treat these as skipped deletions
                        skipped_count += len(corruption_hits)
                    # Attach for return payload
                    self._last_corruption_hits = corruption_hits
            
            # Step 5: Backup database before committing changes (always backup if there are any changes)
            backup_result = None
            if added_count > 0 or updated_count > 0 or deleted_count > 0:
                if actual_db_path and os.path.exists(actual_db_path):
                    print(f"Step 5: Creating backup before committing changes...", file=sys.stderr)
                    backup_result = self.backup_database(actual_db_path)
                    if backup_result.get("success"):
                        print(f"✓ Backup created: {backup_result.get('backup_path', 'unknown')}", file=sys.stderr)
                        print(f"  Backup count: {backup_result.get('backup_count', 0)}", file=sys.stderr)
                    else:
                        print(f"⚠ Warning: Backup failed: {backup_result.get('error', 'unknown error')}", file=sys.stderr)
                        # Continue with commit even if backup fails, but warn user
                        errors.append(f"Backup failed: {backup_result.get('error', 'unknown error')}")
            
            # Step 6: Commit changes (including deletions)
            if added_count > 0 or updated_count > 0 or deleted_count > 0:
                try:
                    total_changes = added_count + updated_count + deleted_count
                    print(f"Step 6: Committing {total_changes} changes to database ({added_count} added, {updated_count} updated, {deleted_count} deleted)...", file=sys.stderr)
                    
                    # Always use autoinc=False: Rekordbox 7 has mixed int/string primary keys that cause
                    # "Could not sort objects by primary key; '<' not supported between str and int" during flush.
                    # Skipping USN autoincrement avoids this; data is still saved correctly.
                    print(f"  Using autoinc=False (avoids Rekordbox 7 mixed primary key type issue)...", file=sys.stderr)
                    self.db.commit(autoinc=False)
                    
                    print("✓ Changes committed successfully", file=sys.stderr)
                    print("✓ Export workflow completed successfully", file=sys.stderr)
                except RuntimeError as e:
                    if "Rekordbox is running" in str(e):
                        return {
                            "success": False,
                            "error": "Rekordbox must be closed before exporting changes. Please close Rekordbox and try again.",
                            "added": added_count,
                            "updated": updated_count,
                            "deleted": deleted_count,
                            "skipped": skipped_count
                        }
                    else:
                        raise
                except Exception as e:
                    error_str = str(e)
                    print(f"⚠️ WARNING: Commit with USN autoincrement failed", file=sys.stderr)
                    
                    # Check if it's a database lock/corruption error
                    is_lock_error = "malformed" in error_str.lower() or "corrupt" in error_str.lower() or "database disk image" in error_str.lower()
                    
                    if is_lock_error:
                        print("💡 This usually means Rekordbox is open and has the database locked.", file=sys.stderr)
                        print("💡 Attempting fallback: committing without USN autoincrement...", file=sys.stderr)
                    else:
                        # For other errors, show full traceback
                        import traceback
                        traceback.print_exc(file=sys.stderr)
                    
                    # Try to rollback on error
                    try:
                        self.db.rollback()
                        print("✓ Rolled back transaction", file=sys.stderr)
                    except Exception as rollback_error:
                        print(f"⚠ Error rolling back: {rollback_error}", file=sys.stderr)
                    
                    # Try committing without autoincrement (works even if Rekordbox is open)
                    if is_lock_error:
                        try:
                            self.db.commit(autoinc=False)
                            print("✓ Committed successfully without USN updates", file=sys.stderr)
                            print("ℹ️  Note: All data was saved. USN (Update Sequence Number) was not incremented.", file=sys.stderr)
                            print("ℹ️  Tip: Close Rekordbox before exporting to avoid this warning and enable USN updates.", file=sys.stderr)
                            return {
                                "success": True,
                                "added": added_count,
                                "updated": updated_count,
                                "deleted": deleted_count,
                                "skipped": skipped_count,
                                "warning": "Committed without USN updates (Rekordbox may be open - close it next time to avoid this)"
                            }
                        except Exception as retry_error:
                            return {
                                "success": False,
                                "error": f"Database corruption detected: {error_str}",
                                "suggestion": "The database appears to be corrupted. Please restore from a backup.",
                                "added": added_count,
                                "updated": updated_count,
                                "deleted": deleted_count,
                                "skipped": skipped_count
                            }
                    else:
                        if "sort" in error_str.lower() and ("str" in error_str or "int" in error_str):
                            error_str += "\n\nTip: Rekordbox 7 mixed primary key types. Close Rekordbox, backup your DB, then retry."
                        return {
                            "success": False,
                            "error": f"Failed to commit changes: {error_str}",
                            "added": added_count,
                            "updated": updated_count,
                            "deleted": deleted_count,
                            "skipped": skipped_count
                        }
            else:
                print("No changes to commit (all tracks skipped or unchanged)", file=sys.stderr)
            
            # Step 7: Export playlists
            playlist_added_count = 0
            playlist_updated_count = 0
            playlist_skipped_count = 0
            
            if playlists:
                print(f"Step 7: Processing playlists...", file=sys.stderr)
                print(f"  Found {len(playlists)} playlists to export", file=sys.stderr)
                
                # Create a map of Bonk TrackID to Rekordbox Content ID
                track_id_to_content_id = {}
                for content in self.db.get_content():
                    # Try to match by path - we'll need to normalize paths
                    path = content.FolderPath
                    if path:
                        normalized_path = normalize_path_for_comparison(path)
                        # Find matching track in Bonk library
                        for track in tracks:
                            track_location = track.get("Location", "")
                            track_normalized = normalize_path_for_comparison(track_location)
                            if track_normalized == normalized_path:
                                track_id_to_content_id[track.get("TrackID")] = str(content.ID)
                                break
                
                print(f"  Mapped {len(track_id_to_content_id)} tracks to Rekordbox content IDs", file=sys.stderr)
                
                # Create a map of existing playlists by name (for updating)
                existing_playlists = {}
                for playlist in self.db.get_playlist():
                    existing_playlists[playlist.Name] = playlist
                
                # Process playlists in order: folders first, then playlists
                # This ensures parent folders exist before creating child playlists
                
                # Separate folders and playlists
                folders = [p for p in playlists if p.get("Type") == "0"]
                regular_playlists = [p for p in playlists if p.get("Type") == "1"]
                smart_playlists = [p for p in playlists if p.get("Type") == "2"]
                print(f"Step 7: Found {len(folders)} folders, {len(regular_playlists)} regular playlists, {len(smart_playlists)} smart playlists", file=sys.stderr)
                
                # Process folders first
                for folder in folders:
                    try:
                        folder_name = folder.get("Name", "Unnamed")
                        parent_name = None
                        
                        # Find parent if specified
                        parent_playlist = None
                        if folder.get("ParentID"):
                            # Look up parent by name or ID
                            for p in playlists:
                                if p.get("PlaylistID") == folder.get("ParentID") or p.get("Name") == folder.get("ParentID"):
                                    parent_name = p.get("Name")
                                    break
                        
                        if parent_name:
                            parent_playlist = existing_playlists.get(parent_name)
                        
                        # Check if folder already exists
                        existing = existing_playlists.get(folder_name)
                        if existing:
                            # Update existing folder (just update parent if changed)
                            if parent_playlist and existing.ParentID != parent_playlist.ID:
                                existing.ParentID = parent_playlist.ID
                                playlist_updated_count += 1
                            else:
                                playlist_skipped_count += 1
                        else:
                            # Create new folder
                            new_folder = self.db.create_playlist_folder(folder_name, parent=parent_playlist)
                            existing_playlists[folder_name] = new_folder
                            playlist_added_count += 1
                            print(f"  Created folder: {folder_name}", file=sys.stderr)
                    except Exception as e:
                        errors.append(f"Failed to export folder {folder.get('Name', 'unknown')}: {str(e)}")
                        playlist_skipped_count += 1
                
                # Process regular playlists
                for playlist in regular_playlists:
                    try:
                        playlist_name = playlist.get("Name", "Unnamed")
                        parent_name = None
                        
                        # Find parent if specified
                        parent_playlist = None
                        if playlist.get("ParentID"):
                            for p in playlists:
                                if p.get("PlaylistID") == playlist.get("ParentID") or p.get("Name") == playlist.get("ParentID"):
                                    parent_name = p.get("Name")
                                    break
                        
                        if parent_name:
                            parent_playlist = existing_playlists.get(parent_name)
                        
                        # Check if playlist already exists
                        existing = existing_playlists.get(playlist_name)
                        
                        # Get track entries
                        entries = playlist.get("Entries", [])
                        content_ids = []
                        for track_id in entries:
                            content_id = track_id_to_content_id.get(track_id)
                            if content_id:
                                # Convert to int immediately to ensure type consistency
                                try:
                                    content_ids.append(int(content_id))
                                except (ValueError, TypeError):
                                    print(f"  Warning: Invalid content ID '{content_id}' for track {track_id}, skipping", file=sys.stderr)
                            else:
                                # Track not found in Rekordbox, skip it
                                pass
                        
                        if existing:
                            # Update existing playlist
                            # Clear existing entries using pyrekordbox tracking (no commit here)
                            try:
                                for song in list(getattr(existing, "Songs", []) or []):
                                    try:
                                        self.db.delete(song)
                                    except Exception as e:
                                        print(f"  Warning: Could not remove song from playlist '{playlist_name}': {e}", file=sys.stderr)
                            except Exception as e:
                                print(f"  Warning: Could not enumerate songs for playlist '{playlist_name}': {e}", file=sys.stderr)
                            
                            # Add new entries using pyrekordbox high-level API (handles TrackNo/USN)
                            for idx, content_id in enumerate(content_ids):
                                try:
                                    content = self.db.get_content(ID=content_id)
                                    if content is None:
                                        print(f"  Warning: Track {content_id} not found in database, skipping", file=sys.stderr)
                                        continue
                                    self.db.add_to_playlist(existing, content, track_no=idx + 1)
                                except Exception as e:
                                    print(f"  Warning: Could not add track {content_id} to playlist '{playlist_name}': {e}", file=sys.stderr)
                            
                            # Update parent if changed
                            if parent_playlist and existing.ParentID != parent_playlist.ID:
                                existing.ParentID = parent_playlist.ID
                            
                            playlist_updated_count += 1
                            print(f"  Updated playlist: {playlist_name} ({len(content_ids)} tracks)", file=sys.stderr)
                        else:
                            # Create new playlist
                            new_playlist = self.db.create_playlist(playlist_name, parent=parent_playlist)
                            existing_playlists[playlist_name] = new_playlist
                            
                            # Add tracks to playlist
                            for idx, content_id in enumerate(content_ids):
                                try:
                                    content = self.db.get_content(ID=content_id)
                                    if content is None:
                                        print(f"  Warning: Track {content_id} not found in database, skipping", file=sys.stderr)
                                        continue
                                    self.db.add_to_playlist(new_playlist, content, track_no=idx + 1)
                                except Exception as e:
                                    print(f"  Warning: Could not add track {content_id} to playlist '{playlist_name}': {e}", file=sys.stderr)
                            
                            playlist_added_count += 1
                            print(f"  Created playlist: {playlist_name} ({len(content_ids)} tracks)", file=sys.stderr)
                    except Exception as e:
                        errors.append(f"Failed to export playlist {playlist.get('Name', 'unknown')}: {str(e)}")
                        import traceback
                        traceback.print_exc(file=sys.stderr)
                        playlist_skipped_count += 1
                
                # Process smart playlists
                print(f"  Processing {len(smart_playlists)} smart playlists...", file=sys.stderr)
                for playlist in smart_playlists:
                    try:
                        playlist_name = playlist.get("Name", "Unnamed")
                        conditions = playlist.get("conditions", [])
                        logical_operator = playlist.get("logicalOperator", 1)  # Default to ALL (1)
                        print(f"  Processing smart playlist: {playlist_name} ({len(conditions)} conditions)", file=sys.stderr)
                        
                        # Find parent if specified
                        parent_playlist = None
                        parent_name = None
                        if playlist.get("ParentID"):
                            for p in playlists:
                                if p.get("PlaylistID") == playlist.get("ParentID") or p.get("Name") == playlist.get("ParentID"):
                                    parent_name = p.get("Name")
                                    break
                        
                        if parent_name:
                            parent_playlist = existing_playlists.get(parent_name)
                        
                        # Check if smart playlist already exists
                        existing = existing_playlists.get(playlist_name)
                        
                        if not conditions:
                            # No conditions provided - skip
                            playlist_skipped_count += 1
                            print(f"  Skipped smart playlist (no conditions): {playlist_name}", file=sys.stderr)
                            continue
                        
                        # Normalize conditions: Map CUSTOM_TAG to MYTAG for Rekordbox
                        normalized_conditions = []
                        for cond in conditions:
                            normalized_cond = dict(cond)
                            if cond.get("property") == "CUSTOM_TAG":
                                normalized_cond["property"] = "MYTAG"
                            normalized_conditions.append(normalized_cond)
                        
                        # Create SmartList object
                        smart = SmartList(logical_operator=logical_operator)
                        
                        # Add conditions to SmartList
                        for condition in normalized_conditions:
                            property_name = condition.get("property", "").upper()  # Ensure uppercase
                            operator_value = condition.get("operator", "").upper()  # Ensure uppercase
                            value_left = condition.get("value_left", "")
                            value_right = condition.get("value_right")
                            
                            # Map string property names to Property enum
                            property_enum = getattr(Property, property_name, None)
                            if not property_enum:
                                print(f"  Warning: Unknown property '{property_name}' in smart playlist '{playlist_name}', skipping condition", file=sys.stderr)
                                continue
                            
                            # Map string operators to Operator enum
                            operator_map = {
                                "EQUAL": Operator.EQUAL, "NOT_EQUAL": Operator.NOT_EQUAL,
                                "GREATER": Operator.GREATER, "LESS": Operator.LESS,
                                "IN_RANGE": Operator.IN_RANGE, "IN_LAST": Operator.IN_LAST,
                                "NOT_IN_LAST": Operator.NOT_IN_LAST, "CONTAINS": Operator.CONTAINS,
                                "NOT_CONTAINS": Operator.NOT_CONTAINS, "STARTS_WITH": Operator.STARTS_WITH,
                                "ENDS_WITH": Operator.ENDS_WITH
                            }
                            operator_enum = operator_map.get(operator_value)
                            if operator_enum is None:
                                print(f"  Warning: Unknown operator '{operator_value}' in smart playlist '{playlist_name}', skipping condition", file=sys.stderr)
                                continue
                            
                            # Add condition to smart list
                            if value_right:
                                smart.add_condition(property_enum, operator_enum, value_left, value_right)
                            else:
                                smart.add_condition(property_enum, operator_enum, value_left)
                        
                        if existing and existing.is_smart_playlist:
                            # Update existing smart playlist
                            # Delete and recreate (Rekordbox doesn't have a direct update method)
                            try:
                                self.db.delete_playlist(existing)
                                new_smart = self.db.create_smart_playlist(playlist_name, smart, parent=parent_playlist)
                                existing_playlists[playlist_name] = new_smart
                                playlist_updated_count += 1
                                print(f"  Updated smart playlist: {playlist_name} ({len(conditions)} conditions)", file=sys.stderr)
                            except Exception as e:
                                errors.append(f"Failed to update smart playlist {playlist_name}: {str(e)}")
                                playlist_skipped_count += 1
                        else:
                            # Create new smart playlist
                            new_smart = self.db.create_smart_playlist(playlist_name, smart, parent=parent_playlist)
                            existing_playlists[playlist_name] = new_smart
                            playlist_added_count += 1
                            print(f"  Created smart playlist: {playlist_name} ({len(conditions)} conditions)", file=sys.stderr)
                    except Exception as e:
                        errors.append(f"Failed to export smart playlist {playlist.get('Name', 'unknown')}: {str(e)}")
                        import traceback
                        traceback.print_exc(file=sys.stderr)
                        playlist_skipped_count += 1
                
                # Commit playlist changes
                if playlist_added_count > 0 or playlist_updated_count > 0:
                    try:
                        print(f"Step 8: Committing playlist changes ({playlist_added_count} added, {playlist_updated_count} updated)...", file=sys.stderr)
                        self.db.commit()
                        print("✓ Playlist changes committed successfully", file=sys.stderr)
                    except Exception as e:
                        error_str = str(e)
                        print(f"ERROR committing playlists: {error_str}", file=sys.stderr)
                        
                        # Try to rollback
                        try:
                            self.db.rollback()
                            print("✓ Rolled back playlist transaction", file=sys.stderr)
                        except Exception as rollback_error:
                            print(f"Error rolling back playlist changes: {rollback_error}", file=sys.stderr)
                        
                        # Check if it's a corruption error - try committing without autoincrement
                        if "malformed" in error_str.lower() or "corrupt" in error_str.lower() or "database disk image" in error_str.lower():
                            print("Attempting to commit playlists without USN autoincrement...", file=sys.stderr)
                            try:
                                self.db.commit(autoinc=False)
                                print("✓ Playlist changes committed successfully without USN updates", file=sys.stderr)
                            except Exception as retry_error:
                                errors.append(f"Failed to commit playlist changes: {error_str}")
                                print("⚠ Database corruption detected during playlist commit", file=sys.stderr)
                                print("⚠ Playlists were not saved due to corruption", file=sys.stderr)
                        else:
                            errors.append(f"Failed to commit playlist changes: {error_str}")
            
            print(f"Export summary: {added_count} tracks added, {updated_count} tracks updated, {deleted_count} tracks deleted, {skipped_count} tracks skipped", file=sys.stderr)
            print(f"Playlist summary: {playlist_added_count} playlists added, {playlist_updated_count} playlists updated, {playlist_skipped_count} playlists skipped", file=sys.stderr)
            if skipped_count > 0:
                print(f"  Note: Skipped tracks are either unchanged or don't exist in database", file=sys.stderr)
            if deleted_count > 0:
                print(f"  Note: {deleted_count} tracks deleted from Rekordbox (not in Bonk library)", file=sys.stderr)
            if errors:
                print(f"Errors: {len(errors)}", file=sys.stderr)
                for error in errors[:5]:  # Print first 5 errors
                    print(f"  - {error}", file=sys.stderr)
            
            return {
                "success": True,
                "added": added_count,
                "updated": updated_count,
                "deleted": deleted_count,
                "skipped": skipped_count,
                "playlists_added": playlist_added_count,
                "playlists_updated": playlist_updated_count,
                "playlists_skipped": playlist_skipped_count,
                "corruption_hits": getattr(self, "_last_corruption_hits", None) or None,
                "errors": errors if errors else None,
                "db_path": actual_db_path
            }
        
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to export to database: {str(e)}"
            }
    
    def sync_to_database(self, tracks: List[Dict], db_path: Optional[str] = None) -> Dict[str, Any]:
        """Sync tracks to Rekordbox database (two-way sync)"""
        try:
            # Open database
            if not self.db:
                result = self.open_database(db_path)
                if not result["success"]:
                    return result
            
            # PRE-FLIGHT CHECK: Verify database integrity before making any changes
            print("Checking database integrity...", file=sys.stderr)
            try:
                # Test database accessibility by querying critical tables
                test_query = self.db.get_content().limit(1).all()
                from pyrekordbox.db6.tables import DjmdSongPlaylist
                test_playlist = self.db.query(DjmdSongPlaylist).limit(1).all()
                print("✓ Database integrity check passed", file=sys.stderr)
            except Exception as integrity_error:
                error_msg = str(integrity_error)
                if "malformed" in error_msg.lower() or "corrupt" in error_msg.lower() or "disk image" in error_msg.lower():
                    return {
                        "success": False,
                        "error": f"❌ DATABASE IS CORRUPTED: {error_msg}\n\nThe database cannot be safely modified. You must restore from a clean backup first."
                    }
                print(f"⚠ Could not check database integrity: {error_msg}", file=sys.stderr)
            
            updated_in_db = 0
            updated_in_bonk = 0
            conflicts = []
            
            # Create a map of existing tracks
            existing_tracks = {}
            for content in self.db.get_content():
                key = content.FolderPath
                existing_tracks[key] = {
                    "id": content.ID,
                    "title": content.Title,
                    "artist": content.ArtistName or "",
                    "comments": content.Commnt,
                    "rating": content.Rating,
                    "key": content.KeyName if content.Key else "",
                    "date_modified": content.DateModified if hasattr(content, 'DateModified') else None,
                    "object": content
                }
            
            # Process each track from Bonk
            tracks_to_return = []
            for track in tracks:
                location = track.get("Location", "").replace("file://localhost", "")
                existing = existing_tracks.get(location)
                
                if existing:
                    # Check for conflicts and merge
                    has_conflict = False
                    
                    # Compare fields and update
                    # For now, Bonk changes take precedence
                    if track.get("Name") and track["Name"] != existing["title"]:
                        existing["object"].Title = track["Name"]
                        updated_in_db += 1
                    
                    if track.get("Comments") and track["Comments"] != existing["comments"]:
                        existing["object"].Commnt = track["Comments"]
                        updated_in_db += 1
                    
                    if track.get("Rating") and str(track["Rating"]) != str(existing["rating"] or ""):
                        try:
                            existing["object"].Rating = int(track["Rating"])
                            updated_in_db += 1
                        except:
                            pass
                    
                    tracks_to_return.append(track)
                else:
                    # Track exists in Bonk but not in Rekordbox
                    tracks_to_return.append(track)
            
            # Commit database changes
            if updated_in_db > 0:
                try:
                    print(f"Committing {updated_in_db} changes to database...", file=sys.stderr)
                    self.db.commit()
                    print("✓ Changes committed successfully", file=sys.stderr)
                except RuntimeError as e:
                    if "Rekordbox is running" in str(e):
                        return {
                            "success": False,
                            "error": "Rekordbox must be closed before syncing changes. Please close Rekordbox and try again.",
                            "updated_in_db": updated_in_db,
                            "updated_in_bonk": updated_in_bonk
                        }
                    else:
                        raise
                except Exception as e:
                    error_str = str(e)
                    print(f"ERROR during commit: {error_str}", file=sys.stderr)
                    import traceback
                    traceback.print_exc(file=sys.stderr)
                    
                    # Try to rollback on error
                    try:
                        self.db.rollback()
                        print("✓ Rolled back transaction due to commit error", file=sys.stderr)
                    except Exception as rollback_error:
                        print(f"Error rolling back: {rollback_error}", file=sys.stderr)
                    
                    # Check if it's a corruption error - try committing without autoincrement
                    if "malformed" in error_str.lower() or "corrupt" in error_str.lower() or "database disk image" in error_str.lower():
                        print("Attempting to commit without USN autoincrement...", file=sys.stderr)
                        try:
                            self.db.commit(autoinc=False)
                            print("✓ Committed successfully without USN updates", file=sys.stderr)
                            return {
                                "success": True,
                                "updated_in_db": updated_in_db,
                                "updated_in_bonk": updated_in_bonk,
                                "warning": "Committed without USN updates due to database corruption"
                            }
                        except Exception as retry_error:
                            return {
                                "success": False,
                                "error": f"Database corruption detected: {error_str}",
                                "suggestion": "The database appears to be corrupted. Please restore from a backup.",
                                "updated_in_db": updated_in_db,
                                "updated_in_bonk": updated_in_bonk
                            }
                    else:
                        return {
                            "success": False,
                            "error": f"Failed to commit changes: {error_str}",
                            "updated_in_db": updated_in_db,
                            "updated_in_bonk": updated_in_bonk
                        }
            
            return {
                "success": True,
                "updated_in_db": updated_in_db,
                "updated_in_bonk": updated_in_bonk,
                "conflicts": conflicts if conflicts else None,
                "tracks": tracks_to_return
            }
        
        except Exception as e:
            return {
                "success": False,
                "error": f"Sync failed: {str(e)}"
            }
    
    def update_track_path(self, track_id: str, new_path: str, old_path: Optional[str] = None, db_path: Optional[str] = None) -> Dict[str, Any]:
        """Update a track's file path in the Rekordbox database
        
        Can find track by ID (if numeric) or by old file path
        """
        try:
            # Open database if not already open
            if not self.db:
                result = self.open_database(db_path)
                if not result["success"]:
                    return result
            
            content = None
            
            # Try to find track by ID first (if it's a numeric ID)
            try:
                track_id_int = int(track_id)
                # get_content(ID=...) already returns DjmdContent or None, not a query
                content = self.db.get_content(ID=track_id_int)
            except (ValueError, TypeError):
                # Track ID is not numeric (probably from XML import)
                # Try to find by file path instead
                pass
            
            # If not found by ID, try to find by old path
            if not content and old_path:
                # Normalize old path for comparison
                normalized_old_path = str(old_path).replace("\\", "/")
                # Remove file:// prefix if present
                if normalized_old_path.startswith("file://localhost"):
                    normalized_old_path = normalized_old_path.replace("file://localhost", "")
                elif normalized_old_path.startswith("file://"):
                    normalized_old_path = normalized_old_path.replace("file://", "")
                
                # Try to find by exact path match
                try:
                    content = self.db.get_content(FolderPath=normalized_old_path).one_or_none()
                except:
                    pass
                
                # If still not found, try case-insensitive search
                if not content:
                    all_content = list(self.db.get_content())
                    for c in all_content:
                        if c.FolderPath and c.FolderPath.lower() == normalized_old_path.lower():
                            content = c
                            break
            
            if not content:
                return {
                    "success": False, 
                    "error": f"Track not found in database (ID: {track_id}, Path: {old_path})",
                    "skipped": True
                }
            
            # Normalize new path (Rekordbox uses forward slashes)
            normalized_path = str(new_path).replace("\\", "/")
            # Remove file:// prefix if present
            if normalized_path.startswith("file://localhost"):
                normalized_path = normalized_path.replace("file://localhost", "")
            elif normalized_path.startswith("file://"):
                normalized_path = normalized_path.replace("file://", "")
            
            old_db_path = content.FolderPath
            
            # Update the path using pyrekordbox's update_content_path
            self.db.update_content_path(content, normalized_path, save=True, check_path=False, commit=True)
            
            return {
                "success": True,
                "track_id": str(content.ID),
                "old_path": old_db_path,
                "new_path": normalized_path
            }
        except Exception as e:
            error_msg = str(e)
            # Check for common database errors
            if "database disk image is malformed" in error_msg or "malformed" in error_msg.lower():
                # Database corruption or lock issue
                if "locked" in error_msg.lower() or "busy" in error_msg.lower():
                    return {
                        "success": False,
                        "error": f"Database is locked. Please close Rekordbox and try again. Error: {error_msg}"
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Database corruption detected. The database may be locked by Rekordbox, or a specific record is corrupted. Try closing Rekordbox and try again. Error: {error_msg}"
                    }
            else:
                return {
                    "success": False,
                    "error": f"Failed to update track path: {error_msg}"
                }
    
    def create_smart_playlist(self, name: str, conditions: List[Dict], logical_operator: int = 1, parent: Optional[str] = None) -> Dict[str, Any]:
        """Create a smart playlist with specified conditions"""
        try:
            # Open database if not already open
            if not self.db:
                result = self.open_database()
                if not result["success"]:
                    return result

            # Create SmartList object
            smart = SmartList(logical_operator=logical_operator)

            # Add conditions
            for condition in conditions:
                property_name = condition.get("property")
                operator_value = condition.get("operator")
                value_left = condition.get("value_left")
                value_right = condition.get("value_right")

                # Map string property names to Property enum
                property_enum = getattr(Property, property_name, None)
                if not property_enum:
                    return {
                        "success": False,
                        "error": f"Unknown property: {property_name}"
                    }

                # Map string operators to Operator enum
                operator_enum = getattr(Operator, operator_value, None)
                if operator_enum is None:
                    return {
                        "success": False,
                        "error": f"Unknown operator: {operator_value}"
                    }

                # Add condition to smart list
                if value_right:
                    smart.add_condition(property_enum, operator_enum, value_left, value_right)
                else:
                    smart.add_condition(property_enum, operator_enum, value_left)

            # Find parent if specified
            parent_playlist = None
            if parent:
                try:
                    parent_playlist = self.db.get_playlist(Name=parent).one_or_none()
                except:
                    pass

            # Create the smart playlist
            playlist = self.db.create_smart_playlist(name, smart, parent=parent_playlist)
            
            # Commit the changes so the playlist is immediately queryable
            try:
                self.db.commit()
                print(f"✓ Smart playlist '{name}' created and committed (ID: {playlist.ID})", file=sys.stderr)
            except Exception as commit_error:
                # If commit fails, try without autoincrement
                error_str = str(commit_error)
                if "malformed" in error_str.lower() or "corrupt" in error_str.lower() or "database disk image" in error_str.lower():
                    print(f"Warning: Commit failed due to corruption, retrying without USN updates...", file=sys.stderr)
                    try:
                        self.db.rollback()
                        # Recreate the playlist since we rolled back
                        playlist = self.db.create_smart_playlist(name, smart, parent=parent_playlist)
                        self.db.commit(autoinc=False)
                        print(f"✓ Smart playlist '{name}' created and committed without USN updates (ID: {playlist.ID})", file=sys.stderr)
                    except Exception as retry_error:
                        # Rollback again if retry fails
                        try:
                            self.db.rollback()
                        except:
                            pass
                        return {
                            "success": False,
                            "error": f"Failed to commit smart playlist: {str(retry_error)}"
                        }
                else:
                    # Rollback on other errors
                    try:
                        self.db.rollback()
                    except:
                        pass
                    return {
                        "success": False,
                        "error": f"Failed to commit smart playlist: {error_str}"
                    }

            return {
                "success": True,
                "playlist_id": str(playlist.ID),
                "playlist_name": playlist.Name,
                "message": f"Smart playlist '{name}' created successfully"
            }

        except Exception as e:
            import traceback
            traceback.print_exc(file=sys.stderr)
            return {
                "success": False,
                "error": f"Failed to create smart playlist: {str(e)}"
            }

    def get_anlz_data(self, track_path: str, db_path: Optional[str] = None) -> Dict[str, Any]:
        """Get waveform preview and cues from Rekordbox ANLZ analysis for a track."""
        try:
            if not self.db:
                result = self.open_database(db_path)
                if not result["success"]:
                    return result

            normalized = str(track_path).replace("\\", "/")
            for prefix in ("file://localhost", "file://"):
                if normalized.lower().startswith(prefix.lower()):
                    normalized = normalized[len(prefix):].lstrip("/")
                    break
            normalized = normalized.strip()

            content = self.db.get_content(FolderPath=normalized).one_or_none()
            if not content:
                for c in self.db.get_content():
                    if not c.FolderPath:
                        continue
                    p = str(c.FolderPath).replace("\\", "/")
                    if p.lower() == normalized.lower():
                        content = c
                        break
            if not content:
                return {"success": True, "waveform": None, "cues": [], "duration_ms": None}

            duration_ms = None
            if content.Length is not None:
                duration_ms = int(content.Length * 1000)

            waveform = None
            cues: List[Dict[str, Any]] = []

            try:
                anlz_files = self.db.read_anlz_files(content)
            except Exception as e:
                return {
                    "success": True,
                    "waveform": None,
                    "cues": [],
                    "duration_ms": duration_ms,
                    "error": str(e),
                }

            for fpath, anlz_file in anlz_files.items():
                try:
                    if "PWAV" in anlz_file and waveform is None:
                        tag = anlz_file.get_tag("PWAV")
                        h, _ = tag.get()
                        waveform = {"preview": [int(x) for x in h.tolist()]}
                    if "PWV4" in anlz_file and waveform is None:
                        tag = anlz_file.get_tag("PWV4")
                        heights, _, _ = tag.get()
                        n = int(heights.shape[0])
                        wf = [int(heights[i, 0]) for i in range(n)]
                        waveform = {"preview": wf}

                    for tag in anlz_file.getall_tags("PCOB"):
                        for ent in tag.struct.entries:
                            cues.append({
                                "time_ms": int(ent.time),
                                "loop_end_ms": int(ent.loop_time) if getattr(ent, "loop_time", None) is not None and int(ent.loop_time) >= 0 else None,
                                "hot_cue": int(ent.hot_cue),
                                "type": "loop" if "loop" in str(getattr(ent, "type", "")).lower() else "cue",
                            })
                except Exception as e:
                    pass

            return {
                "success": True,
                "waveform": waveform,
                "cues": cues,
                "duration_ms": duration_ms,
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "waveform": None,
                "cues": [],
                "duration_ms": None,
            }

    def get_smart_playlist_contents(self, playlist_id: str) -> Dict[str, Any]:
        """Get the contents of a smart playlist"""
        try:
            # Open database if not already open
            if not self.db:
                result = self.open_database()
                if not result["success"]:
                    return result

            # Get the playlist
            try:
                playlist = self.db.get_playlist(ID=int(playlist_id)).one_or_none()
            except:
                return {
                    "success": False,
                    "error": f"Playlist not found: {playlist_id}"
                }

            if not playlist:
                return {
                    "success": False,
                    "error": f"Playlist not found: {playlist_id}"
                }

            # Get playlist contents
            contents = list(self.db.get_playlist_contents(playlist))

            # Convert to our track format
            tracks = []
            for content in contents:
                # Safely get key name
                try:
                    key_name = content.KeyName if content.Key else ""
                except:
                    key_name = ""

                # Safely get remixer name
                try:
                    remixer_name = content.RemixerName if content.Remixer else ""
                except:
                    remixer_name = ""

                # Rekordbox stores BPM multiplied by 100 (e.g., 128.5 BPM = 12850)
                # Convert back to normal BPM by dividing by 100
                bpm_value = None
                if content.BPM is not None:
                    bpm_value = content.BPM / 100.0

                track = {
                    "TrackID": str(content.ID),
                    "Name": content.Title or "",
                    "Artist": content.ArtistName or "",
                    "Album": content.AlbumName or "",
                    "Genre": content.GenreName or "",
                    "Year": str(content.ReleaseYear) if content.ReleaseYear else "",
                    "AverageBpm": str(bpm_value) if bpm_value is not None else "",
                    "TotalTime": str(int(content.Length * 1000)) if content.Length else "",
                    "BitRate": str(content.BitRate) if content.BitRate else "",
                    "SampleRate": str(content.SampleRate) if content.SampleRate else "",
                    "Comments": content.Commnt or "",
                    "Rating": str(content.Rating) if content.Rating else "",
                    "Location": f"file://localhost{content.FolderPath}",
                    "Tonality": key_name,
                    "Key": key_name,
                    "Label": content.LabelName or "",
                    "Remixer": remixer_name,
                    "DateAdded": content.created_at.isoformat() if content.created_at else "",
                    "PlayCount": str(content.DJPlayCount) if content.DJPlayCount else "",
                    "Mix": content.Subtitle or "",
                    "Color": str(content.ColorID) if content.ColorID else "",
                }
                tracks.append(track)

            return {
                "success": True,
                "tracks": tracks,
                "track_count": len(tracks),
                "playlist_name": playlist.Name
            }

        except Exception as e:
            import traceback
            traceback.print_exc(file=sys.stderr)
            return {
                "success": False,
                "error": f"Failed to get smart playlist contents: {str(e)}"
            }

    def apply_smart_fixes(self, track_ids: List[str], fixes: Dict[str, Any]) -> Dict[str, Any]:
        """Apply smart fixes to tracks"""
        try:
            # Open database if not already open
            if not self.db:
                result = self.open_database()
                if not result["success"]:
                    return result

            # Get tracks to process
            tracks_to_update = []
            track_id_set = set(track_ids)

            for content in self.db.get_content():
                if str(content.ID) in track_id_set:
                    tracks_to_update.append(content)

            if not tracks_to_update:
                return {
                    "success": False,
                    "error": "No tracks found to process"
                }

            updated_count = 0
            updates = []

            for content in tracks_to_update:
                original_data = {
                    'TrackID': str(content.ID),
                    'Name': content.Title or '',
                    'Artist': content.ArtistName or '',
                    'Album': content.AlbumName or '',
                    'Genre': content.GenreName or '',
                    'Comments': content.Commnt or '',
                    'Label': content.LabelName or '',
                    'Remixer': ''  # Will be populated if we extract it
                }

                updated_data = original_data.copy()
                track_changed = False

                # Extract Artist From Title
                if fixes.get('extractArtistEnabled'):
                    separator = fixes.get('extractArtistSeparator', ' - ')
                    result_number = fixes.get('extractArtistResultNumber', 1) - 1  # Convert to 0-based

                    if updated_data['Name'] and separator in updated_data['Name']:
                        parts = updated_data['Name'].split(separator)
                        if 0 <= result_number < len(parts):
                            extracted_artist = parts[result_number].strip()
                            if extracted_artist and not updated_data['Artist']:
                                updated_data['Artist'] = extracted_artist
                                # Remove the extracted part from title
                                parts.pop(result_number)
                                updated_data['Name'] = separator.join(parts).strip()
                                track_changed = True

                # Replace Characters With Space
                if fixes.get('replaceCharsEnabled'):
                    chars_to_replace = fixes.get('replaceCharsList', '_')
                    for char in chars_to_replace:
                        for field in ['Name', 'Artist', 'Album', 'Genre', 'Comments', 'Label']:
                            if updated_data[field]:
                                updated_data[field] = updated_data[field].replace(char, ' ')
                                track_changed = True

                # Remove Garbage Characters
                if fixes.get('removeGarbageEnabled'):
                    fields_to_clean = fixes.get('removeGarbageFields', [])
                    garbage_chars = r'^[\s\[\]\|\-]+|[\s\[\]\|\-]+$'

                    for field in fields_to_clean:
                        if field in updated_data and updated_data[field]:
                            # Remove multiple spaces
                            updated_data[field] = re.sub(r'\s+', ' ', updated_data[field])
                            # Remove leading/trailing special chars
                            updated_data[field] = re.sub(garbage_chars, '', updated_data[field])
                            track_changed = True

                # Add (Re)mix Parenthesis
                if fixes.get('addRemixParenthesisEnabled'):
                    fields_to_process = fixes.get('addRemixParenthesisFields', [])
                    remix_pattern = r'\s*-\s*(.*?)(?:mix|remix|version|edit)$'

                    for field in fields_to_process:
                        if field in updated_data and updated_data[field]:
                            match = re.search(remix_pattern, updated_data[field], re.IGNORECASE)
                            if match and '(' not in updated_data[field]:
                                remix_text = match.group(1).strip()
                                # Remove the remix part from the field
                                updated_data[field] = re.sub(remix_pattern, '', updated_data[field], flags=re.IGNORECASE).strip()
                                # Add it in parentheses
                                updated_data[field] += f' ({remix_text})'
                                track_changed = True

                # Extract Remixer
                if fixes.get('extractRemixerEnabled'):
                    if updated_data['Name']:
                        # Look for patterns like (Artist Remix) or (Artist Extended Remix)
                        remix_patterns = [
                            r'\(([^)]+?)(?:extended|club|dance|radio)?\s*(?:remix|mix|version|edit)\)',
                            r'\(([^)]+?)\s+(?:extended|club|dance|radio)?\s*(?:remix|mix|version|edit)\)'
                        ]

                        for pattern in remix_patterns:
                            match = re.search(pattern, updated_data['Name'], re.IGNORECASE)
                            if match:
                                remixer = match.group(1).strip()
                                # Filter out generic terms
                                filter_words = ['original', 'radio', 'club', 'dance', 'extended']
                                if not any(word in remixer.lower() for word in filter_words):
                                    updated_data['Remixer'] = remixer
                                    # Remove the remix info from title
                                    updated_data['Name'] = re.sub(pattern, '', updated_data['Name'], flags=re.IGNORECASE).strip()
                                    # Clean up extra parentheses
                                    updated_data['Name'] = re.sub(r'\(\s*\)', '', updated_data['Name'])
                                    updated_data['Name'] = re.sub(r'\s+', ' ', updated_data['Name']).strip()
                                    track_changed = True
                                    break

                # Remove URLs
                if fixes.get('removeUrlsEnabled'):
                    fields_to_process = fixes.get('removeUrlsFields', [])
                    url_pattern = r'https?://[^\s]+'

                    for field in fields_to_process:
                        if field in updated_data and updated_data[field]:
                            if fixes.get('removeUrlsDeleteAll'):
                                # Delete entire field if it contains a URL
                                if re.search(url_pattern, updated_data[field]):
                                    updated_data[field] = ''
                                    track_changed = True
                            else:
                                # Just remove URLs
                                original = updated_data[field]
                                updated_data[field] = re.sub(url_pattern, '', updated_data[field]).strip()
                                if original != updated_data[field]:
                                    track_changed = True

                # Fix Casing
                if fixes.get('fixCasingEnabled'):
                    fields_to_process = fixes.get('fixCasingFields', [])

                    for field in fields_to_process:
                        if field in updated_data and updated_data[field]:
                            text = updated_data[field]
                            # Check if it's ALL UPPERCASE or all lowercase
                            if text.isupper() or text.islower():
                                # Convert to title case
                                updated_data[field] = text.title()
                                track_changed = True

                # Remove Number Prefix
                if fixes.get('removeNumberPrefixEnabled'):
                    fields_to_process = fixes.get('removeNumberPrefixFields', [])
                    prefix_patterns = [
                        r'^\d+\.\s*',  # 01.
                        r'^\(\d+\)\s*',  # (01)
                        r'^\d+\s*-\s*',  # 01 -
                        r'^\[\d+\]\s*'   # [01]
                    ]

                    for field in fields_to_process:
                        if field in updated_data and updated_data[field]:
                            for pattern in prefix_patterns:
                                updated_data[field] = re.sub(pattern, '', updated_data[field])
                                track_changed = True

                # Apply changes to the database
                if track_changed:
                    try:
                        # Ensure data is clean before updating
                        if updated_data['Name']:
                            updated_data['Name'] = updated_data['Name'].strip()
                        if updated_data['Artist']:
                            updated_data['Artist'] = updated_data['Artist'].strip()
                        if updated_data['Album']:
                            updated_data['Album'] = updated_data['Album'].strip()
                        if updated_data['Genre']:
                            updated_data['Genre'] = updated_data['Genre'].strip()
                        if updated_data['Comments']:
                            updated_data['Comments'] = updated_data['Comments'].strip()
                        if updated_data['Label']:
                            updated_data['Label'] = updated_data['Label'].strip()

                        # Update the database content
                        if updated_data['Name'] != original_data['Name']:
                            content.Title = updated_data['Name'] or None

                        if updated_data['Artist'] != original_data['Artist']:
                            # Find or create artist
                            if updated_data['Artist'] and updated_data['Artist'].strip():
                                try:
                                    artist = self.db.get_artist(Name=updated_data['Artist']).one_or_none()
                                    if not artist:
                                        artist = self.db.add_artist(name=updated_data['Artist'], search_str=updated_data['Artist'].upper())
                                    if artist and artist.ID:
                                        content.ArtistID = artist.ID
                                except Exception as e:
                                    print(f"Error updating artist for track {content.ID}: {e}", file=sys.stderr)

                        if updated_data['Album'] != original_data['Album']:
                            # Find or create album
                            if updated_data['Album'] and updated_data['Album'].strip():
                                try:
                                    album = self.db.get_album(Name=updated_data['Album']).one_or_none()
                                    if not album:
                                        album = self.db.add_album(name=updated_data['Album'])
                                    if album and album.ID:
                                        content.AlbumID = album.ID
                                except Exception as e:
                                    print(f"Error updating album for track {content.ID}: {e}", file=sys.stderr)

                        if updated_data['Genre'] != original_data['Genre']:
                            # Find or create genre
                            if updated_data['Genre'] and updated_data['Genre'].strip():
                                try:
                                    genre = self.db.get_genre(Name=updated_data['Genre']).one_or_none()
                                    if not genre:
                                        genre = self.db.add_genre(name=updated_data['Genre'])
                                    if genre and genre.ID:
                                        content.GenreID = genre.ID
                                except Exception as e:
                                    print(f"Error updating genre for track {content.ID}: {e}", file=sys.stderr)

                        if updated_data['Comments'] != original_data['Comments']:
                            content.Commnt = updated_data['Comments'] or None

                        if updated_data['Label'] != original_data['Label']:
                            # Update Label - use LabelID, not LabelName (which is an association_proxy)
                            if updated_data['Label'] and updated_data['Label'].strip():
                                try:
                                    label = self.db.get_label(Name=updated_data['Label']).one_or_none()
                                    if not label:
                                        label = self.db.add_label(name=updated_data['Label'])
                                    if label and label.ID:
                                        content.LabelID = label.ID
                                except ValueError:
                                    # Label already exists, get it
                                    label = self.db.get_label(Name=updated_data['Label']).one()
                                    if label and label.ID:
                                        content.LabelID = label.ID
                                except Exception as e:
                                    print(f"Error updating label for track {content.ID}: {e}", file=sys.stderr)
                            else:
                                content.LabelID = None

                        updated_count += 1
                        updates.append(updated_data)

                    except Exception as e:
                        print(f"Error updating track {content.ID}: {e}", file=sys.stderr)
                        continue

            # Commit changes
            if updated_count > 0:
                try:
                    print(f"Committing {updated_count} smart fix updates...", file=sys.stderr)
                    self.db.commit()
                    print(f"✓ Committed {updated_count} smart fix updates", file=sys.stderr)
                except Exception as e:
                    error_str = str(e)
                    print(f"Error committing changes: {error_str}", file=sys.stderr)
                    
                    # Try to rollback on error
                    try:
                        self.db.rollback()
                        print("✓ Rolled back transaction due to commit error", file=sys.stderr)
                    except Exception as rollback_error:
                        print(f"Error rolling back: {rollback_error}", file=sys.stderr)
                    
                    # Check if it's a corruption error - try committing without autoincrement
                    if "malformed" in error_str.lower() or "corrupt" in error_str.lower() or "database disk image" in error_str.lower():
                        print("Attempting to commit without USN autoincrement...", file=sys.stderr)
                        try:
                            self.db.commit(autoinc=False)
                            print("✓ Committed successfully without USN updates", file=sys.stderr)
                            return {
                                "success": True,
                                "updated": updated_count,
                                "updates": updates,
                                "errors": [],
                                "warning": "Committed without USN updates due to database corruption"
                            }
                        except Exception as retry_error:
                            return {
                                "success": False,
                                "error": f"Database corruption detected: {error_str}",
                                "suggestion": "The database appears to be corrupted. Please restore from a backup."
                            }
                    else:
                        return {
                            "success": False,
                            "error": f"Failed to commit changes: {error_str}"
                        }

            return {
                "success": True,
                "updated": updated_count,
                "updates": updates,
                "errors": []
            }

        except Exception as e:
            import traceback
            traceback.print_exc(file=sys.stderr)
            return {
                "success": False,
                "error": f"Failed to apply smart fixes: {str(e)}"
            }
    
    def export_to_xml(self, tracks: List[Dict], playlists: List[Dict], output_path: str) -> Dict[str, Any]:
        """Export library to Rekordbox XML using pyrekordbox"""
        try:
            xml = RekordboxXml()
            
            # Add tracks
            track_map = {}
            for track in tracks:
                location = track.get("Location", "").replace("file://localhost", "")
                
                xml_track = xml.add_track(location)
                xml_track["Name"] = track.get("Name", "")
                xml_track["Artist"] = track.get("Artist", "")
                xml_track["TrackID"] = track.get("TrackID", "")
                
                if track.get("Album"):
                    xml_track["Album"] = track["Album"]
                if track.get("Genre"):
                    xml_track["Genre"] = track["Genre"]
                if track.get("Year"):
                    xml_track["Year"] = track["Year"]
                if track.get("AverageBpm"):
                    xml_track["AverageBpm"] = track["AverageBpm"]
                if track.get("Comments"):
                    xml_track["Comments"] = track["Comments"]
                if track.get("Tonality"):
                    xml_track["Tonality"] = track["Tonality"]
                if track.get("Rating"):
                    xml_track["Rating"] = track["Rating"]
                if track.get("Label"):
                    xml_track["Label"] = track["Label"]
                
                track_map[track.get("TrackID")] = xml_track
            
            # Add playlists (simplified - would need recursive handling)
            for playlist in playlists:
                try:
                    pl = xml.add_playlist(playlist.get("Name", "Unknown"))
                    for track_id in playlist.get("Entries", []):
                        if track_id in track_map:
                            pl.add_track(track_id)
                except Exception as e:
                    print(f"Warning: Failed to add playlist {playlist.get('Name')}: {e}", file=sys.stderr)
            
            # Write XML
            xml.write(output_path)
            
            return {
                "success": True,
                "path": output_path,
                "trackCount": len(tracks),
                "playlistCount": len(playlists)
            }
        
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to export XML: {str(e)}"
            }


def main():
    """Main entry point for command-line usage"""
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No command specified"}))
        sys.exit(1)
    
    command = sys.argv[1]
    bridge = RekordboxBridge()
    
    try:
        if command == "get-config":
            result = bridge.get_config()
        
        elif command == "set-config":
            install_dir = sys.argv[2] if len(sys.argv) > 2 else None
            app_dir = sys.argv[3] if len(sys.argv) > 3 else None
            result = bridge.set_config(install_dir, app_dir)
        
        elif command == "import-database":
            db_path = sys.argv[2] if len(sys.argv) > 2 else None
            result = bridge.import_from_database(db_path)
        
        elif command == "backup-database":
            db_path = sys.argv[2] if len(sys.argv) > 2 else None
            result = bridge.backup_database(db_path)
        
        elif command == "export-database":
            if len(sys.argv) < 3:
                result = {"success": False, "error": "Missing library data"}
            else:
                library_json_or_file = sys.argv[2]
                # Check if it's a file reference
                if library_json_or_file.startswith("@"):
                    with open(library_json_or_file[1:], 'r') as f:
                        library = json.load(f)
                else:
                    library = json.loads(library_json_or_file)
                
                db_path = sys.argv[3] if len(sys.argv) > 3 else None
                if db_path == "":
                    db_path = None
                sync_mode = sys.argv[4] if len(sys.argv) > 4 else "overwrite"
                result = bridge.export_to_database(
                    library.get("tracks", []),
                    library.get("playlists", []),
                    db_path,
                    sync_mode
                )
        
        elif command == "sync-database":
            if len(sys.argv) < 3:
                result = {"success": False, "error": "Missing library data"}
            else:
                library_json_or_file = sys.argv[2]
                # Check if it's a file reference
                if library_json_or_file.startswith("@"):
                    with open(library_json_or_file[1:], 'r') as f:
                        library = json.load(f)
                else:
                    library = json.loads(library_json_or_file)
                
                db_path = sys.argv[3] if len(sys.argv) > 3 else None
                if db_path == "":
                    db_path = None
                result = bridge.sync_to_database(library.get("tracks", []), db_path)
        
        elif command == "export-xml":
            if len(sys.argv) < 4:
                result = {"success": False, "error": "Missing arguments"}
            else:
                library_json_or_file = sys.argv[2]
                # Check if it's a file reference
                if library_json_or_file.startswith("@"):
                    with open(library_json_or_file[1:], 'r') as f:
                        library = json.load(f)
                else:
                    library = json.loads(library_json_or_file)
                
                output_path = sys.argv[3]
                result = bridge.export_to_xml(
                    library.get("tracks", []),
                    library.get("playlists", []),
                    output_path
                )
        
        elif command == "update-path":
            if len(sys.argv) < 4:
                result = {"success": False, "error": "Missing arguments"}
            else:
                track_id = sys.argv[2]
                new_path = sys.argv[3]
                # old_path is always the 4th argument (may be empty string)
                old_path = sys.argv[4] if len(sys.argv) > 4 else None
                db_path = sys.argv[5] if len(sys.argv) > 5 else None
                # Convert empty string to None
                if old_path == "" or old_path == '""':
                    old_path = None
                if db_path == "" or db_path == '""':
                    db_path = None
                result = bridge.update_track_path(track_id, new_path, old_path, db_path)
        
        elif command == "create-smart-playlist":
            if len(sys.argv) < 4:
                result = {"success": False, "error": "Missing arguments: name and conditions required"}
            else:
                name = sys.argv[2]
                conditions_json = sys.argv[3]
                logical_operator = int(sys.argv[4]) if len(sys.argv) > 4 else 1
                parent = sys.argv[5] if len(sys.argv) > 5 else None
                if parent == "":
                    parent = None

                try:
                    conditions = json.loads(conditions_json)
                    result = bridge.create_smart_playlist(name, conditions, logical_operator, parent)
                except json.JSONDecodeError as e:
                    result = {"success": False, "error": f"Invalid conditions JSON: {str(e)}"}

        elif command == "create-smart-playlist-from-file":
            if len(sys.argv) < 3:
                result = {"success": False, "error": "Missing file argument"}
            else:
                file_path = sys.argv[2]
                try:
                    with open(file_path, 'r') as f:
                        data = json.load(f)

                    name = data['name']
                    conditions = data['conditions']
                    logical_operator = data.get('logical_operator', 1)
                    parent = data.get('parent')

                    result = bridge.create_smart_playlist(name, conditions, logical_operator, parent)
                except Exception as e:
                    result = {"success": False, "error": f"Failed to read file or create playlist: {str(e)}"}

        elif command == "get-smart-playlist-contents":
            if len(sys.argv) < 3:
                result = {"success": False, "error": "Missing playlist ID"}
            else:
                playlist_id = sys.argv[2]
                result = bridge.get_smart_playlist_contents(playlist_id)

        elif command == "apply-smart-fixes":
            if len(sys.argv) < 3:
                result = {"success": False, "error": "Missing file argument"}
            else:
                file_path = sys.argv[2]
                try:
                    with open(file_path, 'r') as f:
                        data = json.load(f)

                    track_ids = data['trackIds']
                    fixes = data['fixes']

                    result = bridge.apply_smart_fixes(track_ids, fixes)
                except Exception as e:
                    result = {"success": False, "error": f"Failed to read file or apply fixes: {str(e)}"}

        elif command == "check-integrity":
            db_path = sys.argv[2] if len(sys.argv) > 2 else None
            # Open database if path provided
            if db_path:
                open_result = bridge.open_database(db_path)
                if not open_result.get("success"):
                    result = open_result
                else:
                    result = bridge.check_database_integrity()
            else:
                # Try auto-detection
                open_result = bridge.open_database()
                if not open_result.get("success"):
                    result = open_result
                else:
                    result = bridge.check_database_integrity()

        elif command == "repair-database":
            db_path = sys.argv[2] if len(sys.argv) > 2 else None
            # Open database if path provided
            if db_path:
                open_result = bridge.open_database(db_path)
                if not open_result.get("success"):
                    result = open_result
                else:
                    result = bridge.repair_database()
            else:
                # Try auto-detection
                open_result = bridge.open_database()
                if not open_result.get("success"):
                    result = open_result
                else:
                    result = bridge.repair_database()

        elif command == "get-anlz-data":
            if len(sys.argv) < 3:
                result = {"success": False, "error": "Missing track path"}
            else:
                arg = sys.argv[2]
                if arg.startswith("@"):
                    with open(arg[1:], "r") as f:
                        data = json.load(f)
                    track_path = data.get("track_path", "")
                    db_path = data.get("db_path")
                else:
                    track_path = arg
                    db_path = sys.argv[3] if len(sys.argv) > 3 else None
                result = bridge.get_anlz_data(track_path, db_path)

        else:
            result = {"success": False, "error": f"Unknown command: {command}"}
        
        # Always close database when done
        bridge.close_database()
        
        print(json.dumps(result))
    
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()

