#!/bin/bash
# Script to permanently remove Docker app from Trash and stop launch agent

echo "Step 1: Stopping Docker launch agent..."
launchctl bootout gui/$(id -u)/com.docker.helper 2>/dev/null
sudo launchctl bootout system/com.docker.socket 2>/dev/null
sudo launchctl bootout system/com.docker.vmnetd 2>/dev/null

echo "Step 2: Removing Docker app from Trash (requires password)..."
sudo rm -rf ~/.Trash/Docker\ 07-51-12-339.app
sudo rm -rf ~/.Trash/Docker*.app

echo "Step 3: Rebuilding LaunchServices database..."
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -kill -r -domain local -domain system -domain user

echo ""
echo "Done! The Docker app has been permanently removed from Trash."
echo "Restart your Mac to verify the warning is gone."




