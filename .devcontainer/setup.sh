#!/bin/bash

echo ">>> Installing system dependencies..."
sudo apt-get update -q
sudo apt-get install -y \
  wget unzip openjdk-17-jdk nodejs npm \
  libpulse0 xvfb x11vnc novnc websockify \
  libxcb-cursor0 libxcb-icccm4 libxcb-image0 \
  libxcb-keysyms1 libxcb-randr0 libxcb-render-util0 \
  libxcb-xinerama0 libxcb-xkb1 libxkbcommon-x11-0 \
  libx11-xcb1 libxcb1 || true

echo ">>> Installing Android SDK..."
ANDROID_HOME="/home/codespace/android-sdk"
mkdir -p "$ANDROID_HOME/cmdline-tools"

wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O /tmp/cmdline-tools.zip
unzip -q /tmp/cmdline-tools.zip -d /tmp/
mv /tmp/cmdline-tools "$ANDROID_HOME/cmdline-tools/latest"

export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"

echo ">>> Accepting SDK licenses..."
yes | sdkmanager --licenses > /dev/null 2>&1 || true

echo ">>> Installing SDK packages..."
sdkmanager "platform-tools" "emulator" "system-images;android-29;default;x86_64" || true

echo ">>> Creating AVD..."
avdmanager create avd -n "test_avd" -k "system-images;android-29;default;x86_64" --force || true

echo ">>> Installing Appium..."
sudo npm install -g appium || true
appium driver install uiautomator2 || true

echo ">>> Setup complete!"
