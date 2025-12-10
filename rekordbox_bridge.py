#!/usr/bin/env python3
"""
Rekordbox Database Bridge
Provides interface between Electron app and pyrekordbox library
"""

import sys
import json
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

# Add pyrekordbox to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'pyrekordbox-0.4.4'))

try:
    from pyrekordbox import Rekordbox6Database, RekordboxXml, show_config, update_config
    from pyrekordbox.config import __config__ as pyrekordbox_config, get_config
    from pyrekordbox.utils import get_rekordbox_pid
except ImportError as e:
    print(json.dumps({"success": False, "error": f"Failed to import pyrekordbox: {str(e)}"}))
    sys.exit(1)


class RekordboxBridge:
    """Bridge between Electron app and pyrekordbox"""
    
    def __init__(self):
        self.db = None
        self.config = None
        
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
            return {
                "success": False,
                "error": f"Failed to open database: {str(e)}"
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
    
    def backup_database(self, db_path: str) -> Dict[str, Any]:
        """Backup the Rekordbox database file with rotation (keeps 3 backups)"""
        try:
            if not db_path or not os.path.exists(db_path):
                return {
                    "success": False,
                    "error": f"Database file not found: {db_path}"
                }
            
            # Create backup directory next to the database file
            db_dir = os.path.dirname(db_path)
            backup_dir = os.path.join(db_dir, "bonk_backups")
            
            # Create backup directory if it doesn't exist
            os.makedirs(backup_dir, exist_ok=True)
            
            # Generate backup filename with timestamp
            db_filename = os.path.basename(db_path)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_filename = f"{db_filename}.backup_{timestamp}"
            backup_path = os.path.join(backup_dir, backup_filename)
            
            # Copy the database file
            print(f"Creating backup: {backup_path}", file=sys.stderr)
            shutil.copy2(db_path, backup_path)
            
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
                    "Mix": content.Subtitle or "",  # Using Subtitle field for Mix
                    "Color": str(content.ColorID) if content.ColorID else "",
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
            # Get track IDs in playlist
            track_ids = []
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
            
            # Determine type - is_folder is a property, not a method
            try:
                is_folder = playlist.is_folder
            except Exception as e:
                print(f"  Warning: Could not determine if folder, using Attribute: {e}", file=sys.stderr)
                # Fallback: check Attribute directly (1 = folder, 0 = playlist)
                from pyrekordbox.db6.tables import PlaylistType
                is_folder = getattr(playlist, 'Attribute', PlaylistType.PLAYLIST) == PlaylistType.FOLDER
            
            result = {
                "Name": playlist.Name or "Unnamed",
                "Type": "0" if is_folder else "1",  # 0 = folder, 1 = playlist
                "KeyType": "TrackID",
                "Entries": track_ids,
                "Children": children
            }
            
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
                    # Delete tracks from database
                    from pyrekordbox.db6 import tables
                    for content in tracks_to_delete:
                        try:
                            # Remove from all playlists first
                            # Get all playlist entries for this track
                            playlist_entries = self.db.query(tables.DjmdSongPlaylist).filter(
                                tables.DjmdSongPlaylist.ContentID == content.ID
                            ).all()
                            
                            for entry in playlist_entries:
                                self.db.session.delete(entry)
                            
                            # Delete the content entry
                            self.db.session.delete(content)
                            deleted_count += 1
                            
                            if deleted_count <= 3:
                                print(f"  -> Deleting: {content.Title or 'Unknown'} ({content.FolderPath[:60] if content.FolderPath else 'N/A'})", file=sys.stderr)
                        except Exception as e:
                            errors.append(f"Failed to delete track {content.Title or 'unknown'}: {str(e)}")
                            print(f"Error deleting track: {e}", file=sys.stderr)
            
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
                    self.db.commit()
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
                    print(f"ERROR during commit: {e}", file=sys.stderr)
                    import traceback
                    traceback.print_exc(file=sys.stderr)
                    return {
                        "success": False,
                        "error": f"Failed to commit changes: {str(e)}",
                        "added": added_count,
                        "updated": updated_count,
                        "deleted": deleted_count,
                        "skipped": skipped_count
                    }
            else:
                print("No changes to commit (all tracks skipped or unchanged)", file=sys.stderr)
            
            print(f"Export summary: {added_count} added, {updated_count} updated, {deleted_count} deleted, {skipped_count} skipped", file=sys.stderr)
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
                    print(f"ERROR during commit: {e}", file=sys.stderr)
                    import traceback
                    traceback.print_exc(file=sys.stderr)
                    return {
                        "success": False,
                        "error": f"Failed to commit changes: {str(e)}",
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
                content = self.db.get_content(ID=track_id_int).one_or_none()
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
            return {
                "success": False,
                "error": f"Failed to update track path: {str(e)}"
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

