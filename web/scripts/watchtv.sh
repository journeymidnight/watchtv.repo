#!/bin/bash

. /etc/rc.d/init.d/functions
server_pid=/var/run/watchtv/api_server.pid
server_lock=/var/lock/subsys/watchtv_api
server_path=/usr/lib/watchtv/api_server.js
crash_log=/var/log/watchtv/crash.log
node_path=/usr/bin/node
RETVAL=0

start() {
    echo -n "Starting WatchTV server: "
	daemon "nohup $node_path $server_path < /dev/null >> $crash_log 2>&1 &"
	RETVAL=$?
	ps -ef|grep "$node_path $server_path"|grep -v grep|awk '{ print $2 }' > $server_pid
	echo
        [ $RETVAL = 0 ] && touch ${server_lock}
	return $RETVAL
}

stop() {
	echo -n "Stopping WatchTV server: "
	groupid=`ps o pid,pgid|grep ${server_pid}|awk '{print $2}'`
	kill -TERM -${groupid}
	RETVAL=$?
	echo
	[ $RETVAL = 0 ] && rm -f ${server_lock} ${server_pid}
}

case "$1" in
  start)
	start
	;;
  stop)
	stop
	;;
  status)
        status -p ${server_pid} -l ${server_lock} "WatchTV server"
	RETVAL=$?
	;;
  restart)
	stop
	start
	;;
  *)
	echo $"Usage: $prog {start|stop|restart}"
	RETVAL=2
esac

exit $RETVAL
