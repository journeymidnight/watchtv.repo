var React = require('react');
var mui = require('material-ui');

var mixins = require('../mixins.js');
var GraphSelector = require('./graphSelector.js');
var Utility = require('../utility.js');

var GraphInfo = React.createClass({
    mixins: [mixins.materialMixin, mixins.configMixin],
    getInitialState: function(){
        var ip=[],node_id,host="",time="300",metricArr=[],selectedIp=0,selectedTime=0,selected={};
        var ipList = this.props.ips,
            timeList = this.props.timeList,
            nodeGraph = this.props.nodeGraph;
        for(var i = 0;i<ipList.length;i++){
            ipList[i].defalt = false;
        }
        if(this.props.selected!=null){
            selected = this.props.selected;
            ipArr = this.props.selected.ip;
            node_id = this.props.selected.node_id;
            time = this.props.selected.timePeriod;
            metricArr = this.props.selected.metricArr;
            for(var i = 0;i<ipList.length;i++){
                for(var j = 0;j<ipArr.length;j++){
                    if(ipList[i].text == ipArr[j]){
                        ipList[i].defalt = true;
                        ip[ip.length] = ipList[i].text;
                        break;
                    }
                }
            }
            for(var i = 0;i<timeList.length;i++){
                if(this.props.selected.timePeriod == timeList[i].value)
                    selectedTime = i;
            }
        }
        if(ip.length == 0) ip[0] = ipList[0].text;
        return {
            ipList:ipList,
            ip: ip,
            node_id: node_id,
            host:Utility.catHost(ip),
            selected:selected,
            metricArr:metricArr,
            uniq_id: node_id +  host.split(',')[0],
            time:time,
            timeList: timeList,
            selectedTime: selectedTime,
            index:this.props.index,
            nodeGraph:nodeGraph
        }
    },
    addGraph:function(){
        this.refs.addGraphDialog.show();
        var event = Utility.getEvent();
        $(event.target).parent().find('#graphBtn').trigger('click');
    },
    showDelDialog:function(){
        this.refs.delDialog.show();
    },
    changeIp:function(e, checked){
        var checkArr = $(e.target).parents('.ipList').find('input');
        var ip = [];
        for(var i = 0;i<checkArr.length;i++){
            if(checkArr[i].checked){
                ip[ip.length] = checkArr[i].name;
            }
        }
        var node_id = checkArr[0].value;
        var host = Utility.catHost(ip);
        this.setState({
            ip:ip,
            node_id:node_id,
            host: host,
            uniq_id: node_id + host.split(',')[0],
            selected:{},
        });
    },
    changeTime:function(e, selectedIndex, menuItem){
        this.setState({time:menuItem.value,selectedTime:selectedIndex});
    },
    handleSelect: function(name, value){
        var selected = this.state.selected;
        selected[name] = value;
        this.setState({selected: selected});
    },
    addMetric: function(){
        var event = Utility.getEvent(),
            metric = this.getMetric(event),
            obj = $(event.target).parents('.scrollDialog').find(".configInfo");
        obj.append("<span title='"+metric+"' class='metricInfo'> "+metric+"<button onclick='javascript:$(this).parent().remove();'></button></span>");
        obj.find("span").unbind().bind({
            mouseenter:function(){ $(this).find("button").show();},
            mouseleave: function(){$(this).find("button").hide();}
        });
    },
    deleteMetric:function(){
        var event = Utility.getEvent(),
            obj = $(event.target);
        obj.parent().remove();
    },
    saveConfig: function(){
        var event = Utility.getEvent();
        var metric = this.getTotalMetric(event);
        if(metric.length == 0){
            alert("No metric added !!");
            return;
        }
        if(this.state.ip.size == 0){
            alert("No ip selected !!");
            return;
        }
        var nodeGraph = this.state.nodeGraph;
        if(nodeGraph == null)
            this.saveUserGraph(metric);
        else 
            this.saveNodeGraph(metric);
    },
    saveUserGraph:function(metric){
        var user_id,graph,graphs;//graph为新增或修改的当前信息 graphs为之前的所有的信息
        var _this = this;
        $.ajax({
            url:"/user",
            type:"get",
            success:function(data){
                user_id = data._id;
                graphs = data.graphs;
                graph = {
                    ips: _this.state.ip,
                    metrics: metric,
                    time: _this.state.time
                }
                if(_this.state.index != null){//modify
                    $.ajax({
                        type: 'PUT',
                        url: 'graph/'+graphs[_this.state.index]._id,
                        data: {graph: graph},
                        success: function(){
                            _this.refs.addGraphDialog.dismiss();
                            _this.props.onRefresh(graph);
                        }
                    });
                }else{//add 
                    $.ajax({
                        type: 'PUT',
                        url: 'user/'+user_id,
                        data: {graph: graph,graphs:graphs},
                        success: function(){
                            _this.refs.addGraphDialog.dismiss();
                            _this.props.onRefresh(graph);
                        }
                    });
                }
            }
        });
    },
    saveNodeGraph:function(metric){
        var user_id,_this = this,
            nodeGraph = this.state.nodeGraph,
            graphs = nodeGraph.graphInfo[nodeGraph.graphListIndex].graphs,
            graph = {
                ips: _this.state.ip,
                metrics: metric,
                time: _this.state.time
            };
        if(_this.state.index != null){//modify
            $.ajax({
                type: 'PUT',
                url: 'graph/'+graphs[_this.state.index],
                data: {graph: graph},
                success: function(){
                    _this.refs.addGraphDialog.dismiss();
                    _this.props.onRefresh(graph);
                }
            });
        }else{//add 
            $.ajax({
                type: 'PUT',
                url: 'node/'+nodeGraph.node_id,
                data: {graph: graph,nodeGraph:nodeGraph},
                success: function(data){
                    graphs[graphs.length] = data;
                    nodeGraph.graphInfo[nodeGraph.graphListIndex].graphs = graphs;
                    _this.setState({nodeGraph:nodeGraph});
                    _this.refs.addGraphDialog.dismiss();
                    _this.props.onRefresh(graph);
                }
            });
        }
    },
    getMetric:function(event){
        var measurement='',device='',measure='',
            list = $(event.target).parents('.scrollDialog').find('select');
        if(list.length==1){
            measurement = list.eq(0).val();
        }else if(list.length==2){
            measurement = list.eq(0).val();
            measure = ','+list.eq(1).val();
        }else if(list.length==3){
            measurement = list.eq(0).val();
            device = ','+list.eq(1).val();
            measure = ','+list.eq(2).val();
        }
        return measurement+device+measure;
    },
    getTotalMetric:function(){
        var obj = $(event.target).parents('.scrollDialog').find(".configInfo .metricInfo"),
            result=[];
        for(var i = 0;i<obj.size();i++){
            result[i] = obj.eq(i).prop("title");
        }
        return result;
    },
    componentDidMount:function(){
        $(".configInfo span").unbind().bind({
            mouseenter:function(){$(this).find("button").show();},
            mouseleave: function(){$(this).find("button").hide();}
        });
    },
    componentWillReceiveProps:function(){
        this.setState({index:this.props.index});
    },
    deleteConfig: function(){
        var nodeGraph = this.state.nodeGraph;
        if(nodeGraph == null)
            this.deleteUserGraph();
        else 
            this.deleteNodeGraph();
        this.refs.addGraphDialog.dismiss();
        this.refs.delDialog.dismiss();
        this.props.onRefresh(null,"delete");
    },
    deleteUserGraph:function(){
        var _this = this;
        var user_id,graphs,deleteId;
        $.ajax({
            url:"/user",
            type:"get",
            async:false,
            success:function(data){
                user_id = data._id;
                graphs = data.graphs;
                var i = _this.state.index;  
                if(i != null){
                    deleteId= graphs[i]._id;
                    graphs = graphs.slice(0,i).concat(graphs.slice(i+1));
                }
                if(graphs == null){
                    graphs = [];
                }
            }
        });
        $.ajax({
            type: 'PUT',
            url: 'user/'+user_id,
            data: {graphs: graphs,deleteId:deleteId},
            async:false
        });
    },
    deleteNodeGraph:function(){
        var _this = this,
            nodeGraph = this.state.nodeGraph,
            node_id = nodeGraph.node_id,
            graphInfo = nodeGraph.graphInfo,
            graphListIndex = nodeGraph.graphListIndex,
            graphs = graphInfo[graphListIndex].graphs;
        var i = this.state.index;  
        if(i != null){
            deleteId= graphs[i];
            graphs = graphs.slice(0,i).concat(graphs.slice(i+1));
        }
        if(graphs == null){
            graphs = [];
        }
        graphInfo[graphListIndex].graphs = graphs;
        $.ajax({
            type: 'PUT',
            url: 'node/'+node_id,
            data: {graphInfo: graphInfo,deleteId:deleteId},
            async:false,
            success:function(){
                nodeGraph.graphInfo = graphInfo;
                _this.setState({nodeGraph:nodeGraph});
            }
        });
    },
    render: function(){
        var addGraphAction = [
            {text: 'Cancel'},
            {text: 'Submit', onClick: this.saveConfig, ref: 'submit' }
        ];
        var _this = this;
        var ipList = _this.state.ipList.map(function(subArr,index) {
            return <mui.Checkbox
                        name={subArr.text}
                        value={subArr.value}
                        label={subArr.text}
                        defaultChecked={subArr.defalt}
                        onCheck={_this.changeIp}
                        key={index}/>
        });
        var metricArr = _this.state.metricArr.map(function(subArr,index) {
            if(subArr.length>0)
                return (
                        <span title={subArr} key={index} className="metricInfo">
                            {subArr}
                            <button onClick={_this.deleteMetric}></button>
                        </span>
                        );
            else return;
        });
        return (
            <div className="btnParent">
                <div className="graphBtn" onClick={this.addGraph}></div>
                <mui.Dialog title={this.props.title} actions={addGraphAction} 
                            contentClassName="scrollDialog graph" ref="addGraphDialog">
                    <mui.FlatButton label = "Delete" className="delBtn" onClick={this.showDelDialog}/>
                    <mui.Dialog
                        title="delete"
                        actions={[
                            { text: 'Cancel' },
                            { text: 'Submit', onTouchTap: this.deleteConfig, ref: 'submit' }
                        ]}
                        actionFocus="submit"
                        ref="delDialog">
                        Confirm to delete ! 
                    </mui.Dialog>
                    <div style={{minHeight:'170px'}}>
                        <div className="dropDownMenu ipList">
                            {ipList}
                        </div>
                        <div className="dropDownMenu configList">
                            <GraphSelector onSelect={this.handleSelect} selected={this.state.selected}
                                host={this.state.host.split(",")[0]} id={this.state.uniq_id} key={this.state.uniq_id} config={this.state.config}
                            />
                            <div className="addMetricBtn" onClick={this.addMetric}></div>
                        </div>
                        <mui.DropDownMenu selectedIndex={this.state.selectedTime} menuItems={this.state.timeList}
                            onChange = {this.changeTime}
                            className="dropDownMenu timeList"/>
                        <div className="configInfo">{metricArr}</div>
                    </div>
                </mui.Dialog>
            </div>
        );
    }
});

module.exports = GraphInfo;