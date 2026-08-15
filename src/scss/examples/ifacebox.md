# ifacebox

## In Overview Page

``` html
<div class="ifacebox" style="margin:.25em;width:100px">
    <div class="ifacebox-head" style="font-weight:bold">lan1</div>
    <div class="ifacebox-body"><img src="/luci-static/resources/icons/port_up.svg"><br><span title="速度：1000 Mbit/s，双工：full">1 GbE</span></div>
    <div class="ifacebox-head cbi-tooltip-container" style="display:flex">
        <div class="zonebadge" style="cursor:help;flex:1;height:3px;opacity:1;--zone-color-rgb:240, 144, 144; background-color:rgb(var(--zone-color-rgb))"></div><span class="cbi-tooltip left">属于以下网络：<br><span class="ifacebadge" style="margin:.125em 0"><span class="zonebadge" title="属于区域 wan" style="--zone-color-rgb:240, 144, 144; background-color:rgb(var(--zone-color-rgb))"> </span> wanb: <img title="以太网适配器: &quot;lan1&quot;" src="/luci-static/resources/icons/ethernet.svg"></span></span>
    </div>
    <div class="ifacebox-body">
        <div class="cbi-tooltip-container" style="text-align:left;font-size:80%">▲ 183.8 MiB<br>▼ 2.4 GiB<span class="cbi-tooltip"><span><span class="nowrap"><strong>已接收字节数: </strong>2.40 GiB</span><br><span class="nowrap"><strong>已接收数据包: </strong>2.27 MPkts.</span><br><span class="nowrap"><strong>已接收组播: </strong>1.03 KPkts.</span><br><span class="nowrap"><strong>接收错误: </strong>0 Pkts.</span><br><span class="nowrap"><strong>接收丢包: </strong>61.73 KPkts.</span><br><span class="nowrap"><strong>已发送字节数: </strong>183.77 MiB</span><br><span class="nowrap"><strong>已发送数据包: </strong>769.11 KPkts.</span><br><span class="nowrap"><strong>发送错误: </strong>0 Pkts.</span><br><span class="nowrap"><strong>发送丢包: </strong>3 Pkts.</span><br><span class="nowrap"><strong>发现冲突: </strong>0</span></span></span></div>
    </div>
</div>
```

## In Network> Interfaces Page

``` html
<td class="td cbi-value-field" data-name="_ifacebox" data-widget="CBI.DummyValue">
    <div class="ifacebox">
        <div class="ifacebox-head" style="--zone-color-rgb: 144, 240, 144; background-color: rgb(144, 240, 144);" title="属于区域 lan">
            <strong>lan</strong>
        </div>
        <div class="ifacebox-body" id="lan-ifc-devices" data-network="lan">
            <span class="cbi-tooltip-container">
                <img class="middle" src="/luci-static/resources/icons/bridge.svg">
                <span class="cbi-tooltip ifacebadge large">
                    <img src="/luci-static/resources/icons/bridge.svg">
                    <span class="left">
                        <span class="nowrap">
                            <strong>类型: </strong>网桥</span>
                        <br>
                        <span class="nowrap">
                            <strong>设备: </strong>br-lan</span>
                        <br>
                        <span class="nowrap">
                            <strong>已连接: </strong>是</span>
                        <br>
                        <span class="nowrap">
                            <strong>MAC: </strong>00:00:5E:00:53:01</span>
                        <br>
                        <span class="nowrap">
                            <strong>接收: </strong>407.95 MB (783576 个数据包)</span>
                        <br>
                        <span class="nowrap">
                            <strong>发送: </strong>2.23 GB (1439608 个数据包)</span>
                    </span>
                </span>
            </span>
            <span> (<span class="cbi-tooltip-container">
                    <img class="middle" src="/luci-static/resources/icons/ethernet.svg">
                    <span class="cbi-tooltip ifacebadge large">
                        <img src="/luci-static/resources/icons/ethernet.svg">
                        <span class="left">
                            <span class="nowrap">
                                <strong>类型: </strong>以太网适配器</span>
                            <br>
                            <span class="nowrap">
                                <strong>设备: </strong>lan2</span>
                            <br>
                            <span class="nowrap">
                                <strong>已连接: </strong>是</span>
                            <br>
                            <span class="nowrap">
                                <strong>MAC: </strong>00:00:5E:00:53:02</span>
                            <br>
                            <span class="nowrap">
                                <strong>接收: </strong>0 B (0 个数据包)</span>
                            <br>
                            <span class="nowrap">
                                <strong>发送: </strong>0 B (0 个数据包)</span>
                        </span>
                    </span>
                </span>
                <span class="cbi-tooltip-container">
                    <img class="middle" src="/luci-static/resources/icons/ethernet.svg">
                    <span class="cbi-tooltip ifacebadge large">
                        <img src="/luci-static/resources/icons/ethernet.svg">
                        <span class="left">
                            <span class="nowrap">
                                <strong>类型: </strong>以太网适配器</span>
                            <br>
                            <span class="nowrap">
                                <strong>设备: </strong>lan3</span>
                            <br>
                            <span class="nowrap">
                                <strong>已连接: </strong>是</span>
                            <br>
                            <span class="nowrap">
                                <strong>MAC: </strong>00:00:5E:00:53:03</span>
                            <br>
                            <span class="nowrap">
                                <strong>接收: </strong>655.41 MB (2421489 个数据包)</span>
                            <br>
                            <span class="nowrap">
                                <strong>发送: </strong>2.41 GB (3055814 个数据包)</span>
                        </span>
                    </span>
                </span>
                <span class="cbi-tooltip-container">
                    <img class="middle" src="/luci-static/resources/icons/ethernet.svg">
                    <span class="cbi-tooltip ifacebadge large">
                        <img src="/luci-static/resources/icons/ethernet.svg">
                        <span class="left">
                            <span class="nowrap">
                                <strong>类型: </strong>以太网适配器</span>
                            <br>
                            <span class="nowrap">
                                <strong>设备: </strong>lan4</span>
                            <br>
                            <span class="nowrap">
                                <strong>已连接: </strong>是</span>
                            <br>
                            <span class="nowrap">
                                <strong>MAC: </strong>00:00:5E:00:53:04</span>
                            <br>
                            <span class="nowrap">
                                <strong>接收: </strong>20.02 MB (160700 个数据包)</span>
                            <br>
                            <span class="nowrap">
                                <strong>发送: </strong>499.96 MB (382300 个数据包)</span>
                        </span>
                    </span>
                </span>
                <span class="cbi-tooltip-container">
                    <img class="middle" src="/luci-static/resources/icons/wifi.svg">
                    <span class="cbi-tooltip ifacebadge large">
                        <img src="/luci-static/resources/icons/wifi.svg">
                        <span class="left">
                            <span class="nowrap">
                                <strong>类型: </strong>无线适配器</span>
                            <br>
                            <span class="nowrap">
                                <strong>设备: </strong>phy1-ap0</span>
                            <br>
                            <span class="nowrap">
                                <strong>已连接: </strong>是</span>
                            <br>
                            <span class="nowrap">
                                <strong>MAC: </strong>00:00:5E:00:53:11</span>
                            <br>
                            <span class="nowrap">
                                <strong>接收: </strong>0 B (0 个数据包)</span>
                            <br>
                            <span class="nowrap">
                                <strong>发送: </strong>2.51 MB (14710 个数据包)</span>
                        </span>
                    </span>
                </span>
                <span class="cbi-tooltip-container">
                    <img class="middle" src="/luci-static/resources/icons/wifi.svg">
                    <span class="cbi-tooltip ifacebadge large">
                        <img src="/luci-static/resources/icons/wifi.svg">
                        <span class="left">
                            <span class="nowrap">
                                <strong>类型: </strong>无线适配器</span>
                            <br>
                            <span class="nowrap">
                                <strong>设备: </strong>phy1-ap1</span>
                            <br>
                            <span class="nowrap">
                                <strong>已连接: </strong>是</span>
                            <br>
                            <span class="nowrap">
                                <strong>MAC: </strong>00:00:5E:00:53:12</span>
                            <br>
                            <span class="nowrap">
                                <strong>接收: </strong>775.67 KB (6893 个数据包)</span>
                            <br>
                            <span class="nowrap">
                                <strong>发送: </strong>3.39 MB (22706 个数据包)</span>
                        </span>
                    </span>
                </span>
                <span class="cbi-tooltip-container">
                    <img class="middle" src="/luci-static/resources/icons/wifi.svg">
                    <span class="cbi-tooltip ifacebadge large">
                        <img src="/luci-static/resources/icons/wifi.svg">
                        <span class="left">
                            <span class="nowrap">
                                <strong>类型: </strong>无线适配器</span>
                            <br>
                            <span class="nowrap">
                                <strong>设备: </strong>phy2-ap0</span>
                            <br>
                            <span class="nowrap">
                                <strong>已连接: </strong>是</span>
                            <br>
                            <span class="nowrap">
                                <strong>MAC: </strong>00:00:5E:00:53:21</span>
                            <br>
                            <span class="nowrap">
                                <strong>接收: </strong>309.42 MB (382186 个数据包)</span>
                            <br>
                            <span class="nowrap">
                                <strong>发送: </strong>735.07 MB (653202 个数据包)</span>
                        </span>
                    </span>
                </span>
                <span class="cbi-tooltip-container">
                    <img class="middle" src="/luci-static/resources/icons/wifi.svg">
                    <span class="cbi-tooltip ifacebadge large">
                        <img src="/luci-static/resources/icons/wifi.svg">
                        <span class="left">
                            <span class="nowrap">
                                <strong>类型: </strong>无线适配器</span>
                            <br>
                            <span class="nowrap">
                                <strong>设备: </strong>phy2-ap1</span>
                            <br>
                            <span class="nowrap">
                                <strong>已连接: </strong>是</span>
                            <br>
                            <span class="nowrap">
                                <strong>MAC: </strong>00:00:5E:00:53:22</span>
                            <br>
                            <span class="nowrap">
                                <strong>接收: </strong>0 B (0 个数据包)</span>
                            <br>
                            <span class="nowrap">
                                <strong>发送: </strong>2.43 MB (14236 个数据包)</span>
                        </span>
                    </span>
                </span>)</span>
            <br>
            <small>br-lan</small>
        </div>
    </div>
</td>
```
