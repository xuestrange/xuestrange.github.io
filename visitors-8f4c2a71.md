---
layout: default
title: 访问统计
permalink: /visitors-8f4c2a71/
lang: zh-CN
robots: noindex, nofollow, noarchive
sitemap: false
analytics: false
---

# 访问统计

这是站点的受口令保护统计入口。它不出现在导航中，并已标记为不供搜索引擎收录。本站统计数据库只保存按日、按月轮换的密钥摘要和国家、省州级地区，不保存或展示完整 IP 地址。

<section class="analytics-panel" id="analytics-dashboard" data-endpoint="{{ site.analytics_endpoint | escape }}">
    <div class="analytics-setup" id="analytics-setup" hidden>
        <h2>尚未连接统计服务</h2>
        <p>部署统计服务后，在站点配置中填入服务地址即可启用。启用前，公开页面不会发送任何统计请求。</p>
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
            <p id="analytics-period"></p>
            <button class="secondary-button" id="analytics-refresh" type="button">刷新</button>
        </div>

        <div class="analytics-cards" aria-label="访问统计概览">
            <article class="analytics-card">
                <span>累计浏览量</span>
                <strong id="stat-total-views">0</strong>
            </article>
            <article class="analytics-card">
                <span>本月独立访客</span>
                <strong id="stat-month-visitors">0</strong>
            </article>
            <article class="analytics-card">
                <span>今日独立访客</span>
                <strong id="stat-today-visitors">0</strong>
            </article>
            <article class="analytics-card">
                <span>今日浏览量</span>
                <strong id="stat-today-views">0</strong>
            </article>
        </div>

        <section class="analytics-section" aria-labelledby="region-heading">
            <h2 id="region-heading">本月访客地区</h2>
            <div class="analytics-table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th scope="col">国家或地区</th>
                            <th scope="col">省 / 州</th>
                            <th scope="col">访客</th>
                        </tr>
                    </thead>
                    <tbody id="region-rows"></tbody>
                </table>
            </div>
            <p class="analytics-empty" id="region-empty" hidden>本月还没有访问数据。</p>
        </section>

        <section class="analytics-section" aria-labelledby="trend-heading">
            <h2 id="trend-heading">最近 30 天</h2>
            <div class="analytics-table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th scope="col">日期</th>
                            <th scope="col">独立访客</th>
                            <th scope="col">浏览量</th>
                        </tr>
                    </thead>
                    <tbody id="trend-rows"></tbody>
                </table>
            </div>
            <p class="analytics-empty" id="trend-empty" hidden>最近 30 天还没有访问数据。</p>
        </section>

        <section class="analytics-section" aria-labelledby="pages-heading">
            <h2 id="pages-heading">本月热门页面</h2>
            <div class="analytics-table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th scope="col">页面</th>
                            <th scope="col">浏览量</th>
                        </tr>
                    </thead>
                    <tbody id="page-rows"></tbody>
                </table>
            </div>
            <p class="analytics-empty" id="page-empty" hidden>本月还没有页面访问数据。</p>
        </section>

        <p class="analytics-note">独立访客按匿名化 IP 摘要估算。VPN、代理、校园网和移动网络可能影响人数与地区判断；每日和每月摘要会轮换，不能用于跨期追踪个人。</p>
    </div>
</section>

<script defer src="{{ '/assets/js/visitor-dashboard.js' | relative_url }}"></script>
