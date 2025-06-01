#!/bin/bash
echo "Running custom bash script"
ls -a
echo "Environment variables:"
printenv
# Add your custom commands here
sudo arch -x86_64 gem install ffi
sudo arch -x86_64 pod install
