#!/bin/bash

fpm -d nodejs -v 0.1 -n watchtv -s dir -t rpm /usr/lib/watchtv /var/log/watchtv/watchtv.log /etc/init.d/watchtv /etc/logrotate.d/watchtv
