#!/bin/bash

. /etc/rc.d/init.d/functions
server_pid=/var/run/watchtv/api_server.pid
judge_pid=/var/run/watchtv/judge.pid
server_lock=/var/lock/subsys/watchtv_api
judge_lock=/var/lock/subsys/watchtv_judge
server_path=/usr/lib/watchtv/api_server.js
judge_path=/usr/lib/watchtv/judge.js
crash_log=/var/log/watchtv/crash.log
node_path=/root/nodeRelease/node
RETVAL=0

start() {
    echo -n "Starting API server: "
	daemon "nohup $node_path $server_path < /dev/null >> $crash_log 2>&1 &"
	RETVAL=$?
	ps -ef|grep "$node_path $server_path"|grep -v grep|awk '{ print $2 }' > $server_pid
	echo
        [ $RETVAL = 0 ] && touch ${server_lock}
    echo -n "Starting Judge: "
	daemon "nohup $node_path $judge_path < /dev/null >> $crash_log 2>&1 &"
	RETVAL=$?
	ps -ef|grep "node $judge_path"|grep -v grep|awk '{ print $2 }' > $judge_pid
	echo
        [ $RETVAL = 0 ] && touch ${judge_lock}
	return $RETVAL
}

stop() {
	echo -n "Stopping API server: "
	killproc -p ${server_pid} -d 10
	RETVAL=$?
	echo
	[ $RETVAL = 0 ] && rm -f ${server_lock} ${server_pid}

    echo -n "Stopping judge: "
    pid=`cat ${judge_pid}`
	groupid=`ps xao pid,pgid|grep ${pid}|awk '{print $2}'`
	kill -TERM -${groupid}
	RETVAL=$?
	echo
	[ $RETVAL = 0 ] && rm -f ${judge_lock} ${judge_pid}
}

case "$1" in
  start)
	start
	;;
  stop)
	stop
	;;
  status)
        status -p ${server_pid} -l ${server_lock} "API server"
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
