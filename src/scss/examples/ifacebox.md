# ifacebox

## In Overview Page> Port

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

## In Overview Page> Network

```html
<div class="network-status-table">
    <div class="ifacebox">
        <div class="ifacebox-head center active"><strong>IPv4 上游</strong></div>
        <div class="ifacebox-body left"><span><span class="nowrap"><strong>协议: </strong>PPPoE</span><br><span class="nowrap"><strong>地址: </strong>198.51.100.1/32</span><br><span class="nowrap"><strong>网关: </strong>198.51.100.254</span><br><span class="nowrap"><strong>DNS: </strong>1.1.1.1</span><br><span class="nowrap"><strong>DNS: </strong>8.8.8.8</span><br><span class="nowrap"><strong>已连接: </strong>22h 20m 18s</span><br></span>
            <div><span class="ifacebadge"><img src="/luci-static/resources/icons/tunnel.svg" title=""><span><span class="nowrap"><strong>设备: </strong>隧道接口: "pppoe-wan"</span><br></span></span></div>
        </div>
    </div>
    <div class="ifacebox">
        <div class="ifacebox-head center active"><strong>IPv6 上游</strong></div>
        <div class="ifacebox-body left"><span><span class="nowrap"><strong>协议: </strong>DHCPv6 客户端</span><br><span class="nowrap"><strong>分发前缀: </strong>2001:db8:1234:c2e0::/60</span><br><span class="nowrap"><strong>地址: </strong>2001:db8:1234:72ec::/64</span><br><span class="nowrap"><strong>地址: </strong>2001:db8:1234:c2e0::/64</span><br><span class="nowrap"><strong>网关: </strong>fe80::1</span><br><span class="nowrap"><strong>DNS: </strong>2606:4700:4700::1111</span><br><span class="nowrap"><strong>DNS: </strong>2001:4860:4860::8888</span><br><span class="nowrap"><strong>剩余有效期: </strong>0h 39m 50s</span><br><span class="nowrap"><strong>已连接: </strong>22h 20m 2s</span><br><span class="nowrap"><strong>DHCPv6 统计信息: </strong><span class="cbi-tooltip-container">📊<span class="cbi-tooltip"><span><span class="nowrap"><strong>DHCPv6 solicit: </strong>5 pkts</span><br><span class="nowrap"><strong>DHCPv6 advertise: </strong>4 pkts</span><br><span class="nowrap"><strong>DHCPv6 request: </strong>2 pkts</span><br><span class="nowrap"><strong>DHCPv6 confirm: </strong>0 pkts</span><br><span class="nowrap"><strong>DHCPv6 renew: </strong>44 pkts</span><br><span class="nowrap"><strong>DHCPv6 rebind: </strong>0 pkts</span><br><span class="nowrap"><strong>DHCPv6 reply: </strong>46 pkts</span><br><span class="nowrap"><strong>DHCPv6 release: </strong>1 pkts</span><br><span class="nowrap"><strong>DHCPv6 decline: </strong>0 pkts</span><br><span class="nowrap"><strong>DHCPv6 reconfigure: </strong>0 pkts</span><br><span class="nowrap"><strong>DHCPv6 information_request: </strong>0 pkts</span><br><span class="nowrap"><strong>DHCPv6 discarded_packets: </strong>1 pkts</span><br><span class="nowrap"><strong>DHCPv6 transmit_failures: </strong>0 pkts</span></span></span></span></span></span>
            <div><span class="ifacebadge"><img src="/luci-static/resources/icons/tunnel.svg" title=""><span><span class="nowrap"><strong>设备: </strong>隧道接口: "pppoe-wan"</span><br></span></span></div>
        </div>
    </div>
</div>
```

```html
<div class="network-status-table">
    <div class="ifacebox">
        <div class="ifacebox-head center active"><strong>radio0</strong></div>
        <div class="ifacebox-body left"><span><span class="nowrap"><strong>类型: </strong>MediaTek MT7986 802.11ax/b/g/n</span><br><span class="nowrap"><strong>信道: </strong>12 (2.467 GHz)</span><br><span class="nowrap"><strong>国家代码: </strong>CN</span><br><span class="nowrap"><strong>噪声: </strong>-90.00 dBm</span><br><span class="nowrap"><strong>发射功率: </strong>30.00 dBm</span></span>
            <div><span class="ifacebadge"><img src="/luci-static/resources/icons/signal-000-000.svg" title="信号强度: 0 dBm / 质量: 0%"><span><span class="nowrap"><strong>SSID: </strong>OpenWrt_2.4G</span><br><span class="nowrap"><strong>模式: </strong>Master</span><br><span class="nowrap"><strong>BSSID: </strong>00:00:5E:00:53:11</span><br><span class="nowrap"><strong>加密: </strong>mixed WPA2/WPA3 PSK, SAE (CCMP)</span><br><span class="nowrap"><strong>关联数: </strong>-</span><br></span></span><span class="ifacebadge"><img src="/luci-static/resources/icons/signal-000-000.svg" title="信号强度: 0 dBm / 质量: 0%"><span><span class="nowrap"><strong>SSID: </strong>OpenWrt_IoT</span><br><span class="nowrap"><strong>模式: </strong>Master</span><br><span class="nowrap"><strong>BSSID: </strong>00:00:5E:00:53:12</span><br><span class="nowrap"><strong>加密: </strong>mixed WPA/WPA2 PSK (CCMP)</span><br><span class="nowrap"><strong>关联数: </strong>-</span><br></span></span><span class="ifacebadge"><img src="/luci-static/resources/icons/signal-000-000.svg" title="信号强度: 0 dBm / 质量: 0%"><span><span class="nowrap"><strong>SSID: </strong>OpenWrt_Printer</span><br><span class="nowrap"><strong>模式: </strong>Master</span><br><span class="nowrap"><strong>BSSID: </strong>00:00:5E:00:53:13</span><br><span class="nowrap"><strong>加密: </strong>WPA2 PSK (CCMP)</span><br><span class="nowrap"><strong>关联数: </strong>-</span><br></span></span><span class="ifacebadge"><img src="/luci-static/resources/icons/signal-000-000.svg" title="信号强度: 0 dBm / 质量: 0%"><span><span class="nowrap"><strong>SSID: </strong>OpenWrt_Guest</span><br><span class="nowrap"><strong>模式: </strong>Master</span><br><span class="nowrap"><strong>BSSID: </strong>00:00:5E:00:53:14</span><br><span class="nowrap"><strong>加密: </strong>WPA3 OWE (CCMP)</span><br><span class="nowrap"><strong>关联数: </strong>-</span><br></span></span></div>
        </div>
    </div>
    <div class="ifacebox">
        <div class="ifacebox-head center active"><strong>radio1</strong></div>
        <div class="ifacebox-body left"><span><span class="nowrap"><strong>类型: </strong>MediaTek MT7986 802.11ac/ax/n</span><br><span class="nowrap"><strong>速率: </strong>794 Mbit/s</span><br><span class="nowrap"><strong>信道: </strong>56 (5.280 GHz)</span><br><span class="nowrap"><strong>国家代码: </strong>CN</span><br><span class="nowrap"><strong>噪声: </strong>-92.00 dBm</span><br><span class="nowrap"><strong>发射功率: </strong>30.00 dBm</span></span>
            <div><span class="ifacebadge"><img src="/luci-static/resources/icons/signal-050-075.svg" title="信号强度: -62 dBm / 质量: 68%"><span><span class="nowrap"><strong>SSID: </strong>OpenWrt_5G</span><br><span class="nowrap"><strong>模式: </strong>Master</span><br><span class="nowrap"><strong>BSSID: </strong>00:00:5E:00:53:21</span><br><span class="nowrap"><strong>加密: </strong>mixed WPA2/WPA3 PSK, SAE (CCMP)</span><br><span class="nowrap"><strong>关联数: </strong>5</span><br></span></span></div>
        </div>
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
