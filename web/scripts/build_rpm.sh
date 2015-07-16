#!/bin/bash
set -x
# get version, something like 0.1-3-gf4d86cc
version=`git describe|cut -c 2-`

# copy files to expected location
mkdir -p /usr/lib/watchtv
cp -r ../* /usr/lib/watchtv/
mkdir -p /var/log/watchtv
touch /var/log/watchtv/watchtv.log
cp ./watchtv.sh /etc/init.d/watchtv
chmod +x /etc/init.d/watchtv
cp ./watchtv.logrotate /etc/logrotate.d/watchtv
mkdir -p /var/run/watchtv

fpm -d nodejs -v $version -n watchtv -s dir -t rpm /usr/lib/watchtv /var/log/watchtv/watchtv.log /etc/init.d/watchtv /etc/logrotate.d/watchtv
