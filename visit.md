---
layout: default
title: 访问统计
permalink: /visit/
lang: zh-CN
robots: noindex, nofollow, noarchive
sitemap: false
analytics: false
---

# 访问统计

这是站点的受口令保护统计入口。地图汇总自城市统计启用以来的访问，最近记录仅显示日期、估算城市和国家或地区。本站不保存或展示完整 IP 地址。

<section class="analytics-panel" id="analytics-dashboard" data-endpoint="{{ site.analytics_endpoint | escape }}">
    <div class="analytics-setup" id="analytics-setup" hidden>
        <h2>尚未连接统计服务</h2>
        <p>部署统计服务后，在站点配置中填入服务地址即可启用。</p>
    </div>

    <form class="analytics-login" id="analytics-login" action="{{ page.url | relative_url }}" method="get">
        <label for="analytics-token">管理员口令</label>
        <div class="analytics-login-row">
            <input id="analytics-token" type="password" autocomplete="off" spellcheck="false" required>
            <button type="submit">查看统计</button>
        </div>
        <p class="analytics-help">口令不会写入网页配置；页面代码只在当前标签页的内存中使用。</p>
    </form>

    <p class="analytics-status" id="analytics-status" role="status" aria-live="polite"></p>

    <div id="analytics-results" hidden>
        <div class="analytics-toolbar">
            <p id="analytics-updated"></p>
            <button class="secondary-button" id="analytics-refresh" type="button">刷新</button>
        </div>

        <section class="analytics-section analytics-map-section" aria-labelledby="map-heading">
            <h2 id="map-heading">全球访问地图</h2>
            <figure class="visit-map-figure">
                <div class="visit-map-frame" id="visit-map-frame">
                    {% include world-visit-map.svg %}
                    <div class="visit-map-tooltip" id="visit-map-tooltip" role="tooltip" hidden></div>
                </div>
                <figcaption>颜色越深，累计访问次数越多。地图边界仅用于可视化，IP 地理位置为近似结果。</figcaption>
            </figure>
            <p class="analytics-empty" id="map-empty" hidden>还没有可显示在地图上的访问。</p>
            <ol class="sr-only" id="map-summary" aria-label="各国家或地区访问汇总"></ol>
        </section>

        <section class="analytics-section" aria-labelledby="latest-heading">
            <h2 id="latest-heading">最近 10 次访问</h2>
            <div class="analytics-table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th scope="col">日期</th>
                            <th scope="col">城市</th>
                            <th scope="col">国家或地区</th>
                        </tr>
                    </thead>
                    <tbody id="latest-visit-rows"></tbody>
                </table>
            </div>
            <p class="analytics-empty" id="latest-visits-empty" hidden>还没有访问记录。</p>
        </section>

        <p class="analytics-note">每次符合条件的页面加载记为一次访问。VPN、代理、校园网和移动网络可能影响城市与国家判断；数据库不会保存完整 IP 地址。</p>
    </div>
</section>

<script defer src="{{ '/assets/js/visitor-dashboard.js' | relative_url }}"></script>
