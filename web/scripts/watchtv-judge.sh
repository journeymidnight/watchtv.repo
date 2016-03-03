#!/bin/bash

. /etc/rc.d/init.d/functions
server_pid=/var/run/watchtv/api_server.pid
judge_pid=/var/run/watchtv/judge.pid
server_lock=/var/lock/subsys/watchtv_api
judge_lock=/var/lock/subsys/watchtv_judge
server_path=/usr/lib/watchtv/api_server.js
judge_path=/usr/lib/watchtv/judge.js
crash_log=/var/log/watchtv/crash.log
node_path=/letv/nodeRelease/node
RETVAL=0

start() {
    echo -n "Starting Judge: "
	daemon "nohup $node_path $judge_path < /dev/null >> $crash_log 2>&1 &"
	RETVAL=$?
	sleep 3
	ps -ef|grep "node - WatchTV - Judge Dispatcher"|grep -v grep|awk '{ print $2 }' > $judge_pid
	echo
        [ $RETVAL = 0 ] && touch ${judge_lock}
	return $RETVAL
}

stop() {
    echo -n "Stopping Judge: "
    pid=`cat ${judge_pid}`
	groupid=`ps xao pid,pgid|grep ${pid}|awk '{print $2}'`
	kill -TERM -${groupid}
	RETVAL=$?
	echo
	[ $RETVAL = 0 ] && rm -f ${judge_lock} ${judge_pid}
	return $RETVAL
}

case "$1" in
  start)
	start
	;;
  stop)
	stop
	;;
  status)
    status -p ${judge_pid} -l ${judge_lock} "Judge"
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
