#!/bin/bash

# Docker Cleanup Script
# This script removes remaining Docker-related files and clears LaunchServices registrations

echo "Cleaning up Docker-related files..."

# Remove the protected Containers folder (requires user password)
echo "Attempting to remove protected Docker Containers folder..."
sudo rm -rf ~/Library/Containers/com.docker.docker

# Clear LaunchServices database to remove Docker associations
echo "Rebuilding LaunchServices database..."
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -kill -r -domain local -domain system -domain user

# Remove any remaining Docker preferences
echo "Cleaning up preferences..."
rm -f ~/Library/Preferences/com.docker.* 2>/dev/null
rm -f ~/Library/Preferences/group.com.docker.* 2>/dev/null

# Clear any Docker-related cache in temp folders
echo "Cleaning temp caches..."
find /private/var/folders -name "*docker*" -user $(whoami) -exec rm -rf {} \; 2>/dev/null

# Remove LaunchServices secure plist entries (manual step may be needed)
echo ""
echo "If the warning persists, you may need to manually edit:"
echo "~/Library/Preferences/com.apple.LaunchServices/com.apple.launchservices.secure.plist"
echo "and remove entries containing 'com.docker.docker' or 'docker-desktop'"
echo ""
echo "Cleanup complete!"

