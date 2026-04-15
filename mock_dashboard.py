import plotly.graph_objects as go
from plotly.subplots import make_subplots
import plotly.express as px
import plotly.io as pio

# ── Humana Brand Colors ──
GREEN = "#5C9A1B"
LIGHT_GREEN = "#78BE20"
DARK_BLUE = "#005B68"
ORANGE = "#F58220"
TEAL = "#00A19B"
SOFT_BG = "#F8FBF5"
WHITE = "#FFFFFF"
DARK_TEXT = "#2D3436"
GRAY = "#636E72"

PALETTE = [GREEN, DARK_BLUE, ORANGE, TEAL, LIGHT_GREEN, "#E17055"]

# ── Common Layout Settings ──
FONT = dict(family="Inter, Arial, sans-serif", color=DARK_TEXT)
MARGIN = dict(l=40, r=40, t=80, b=40)

# ═══════════════════════════════════════════════════
# CHART 1: Monthly User Reach & Growth (Line + Bar)
# ═══════════════════════════════════════════════════
months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
visitors = [1200, 1850, 2400, 3100, 4200, 5800, 7200, 8900, 10500, 12800, 15200, 18500]
new_users = [800, 1100, 1400, 1900, 2500, 3200, 3800, 4500, 5100, 6200, 7000, 8200]
returning = [400, 750, 1000, 1200, 1700, 2600, 3400, 4400, 5400, 6600, 8200, 10300]

fig1 = make_subplots(specs=[[{"secondary_y": True}]])

fig1.add_trace(go.Bar(
    x=months, y=new_users, name="New Users",
    marker=dict(color=GREEN, cornerradius=6),
    opacity=0.85
), secondary_y=False)

fig1.add_trace(go.Bar(
    x=months, y=returning, name="Returning Users",
    marker=dict(color=DARK_BLUE, cornerradius=6),
    opacity=0.85
), secondary_y=False)

fig1.add_trace(go.Scatter(
    x=months, y=visitors, name="Total Visitors",
    mode="lines+markers",
    line=dict(color=ORANGE, width=3, shape="spline"),
    marker=dict(size=8, symbol="diamond"),
), secondary_y=True)

fig1.update_layout(
    title=dict(text="📈 Monthly Platform Reach", font=dict(size=22, **FONT), x=0.5),
    barmode="stack",
    plot_bgcolor=WHITE, paper_bgcolor=SOFT_BG,
    font=FONT, margin=MARGIN, height=500, width=900,
    legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="center", x=0.5,
                bgcolor="rgba(255,255,255,0.8)", bordercolor="#ddd", borderwidth=1),
    yaxis=dict(title="Users", gridcolor="#E8E8E8", showgrid=True),
    yaxis2=dict(title="Total Visitors", gridcolor="rgba(0,0,0,0)", showgrid=False),
)
fig1.write_image("dashboard_reach.png", scale=3)
fig1.write_html("dashboard_reach.html")
print("[OK] Chart 1: Monthly Reach saved")


# ═══════════════════════════════════════════════════
# CHART 2: Page Engagement Breakdown (Radar Chart)
# ═══════════════════════════════════════════════════
categories = ["Avg Time on Page", "Pages per Session", "Scroll Depth %",
              "Interaction Rate", "Return Visit Rate", "Content Shares"]

pages_data = {
    "Homepage":          [3.2, 4.1, 72, 45, 38, 22],
    "Activities Hub":    [5.8, 3.5, 88, 78, 62, 45],
    "Physical Health":   [4.5, 2.8, 80, 55, 48, 35],
    "Mental Health":     [6.2, 2.5, 92, 65, 58, 52],
    "Social Connection": [4.8, 3.0, 85, 70, 55, 40],
}

fig2 = go.Figure()
colors = [GREEN, ORANGE, DARK_BLUE, TEAL, LIGHT_GREEN]

for i, (page, values) in enumerate(pages_data.items()):
    # Normalize values to 0-100 scale for radar
    max_vals = [7, 5, 100, 100, 100, 60]
    normalized = [v / m * 100 for v, m in zip(values, max_vals)]

    fig2.add_trace(go.Scatterpolar(
        r=normalized + [normalized[0]],
        theta=categories + [categories[0]],
        fill="toself",
        name=page,
        line=dict(color=colors[i], width=2),
        fillcolor=f"rgba{tuple(list(int(colors[i].lstrip('#')[j:j+2], 16) for j in (0, 2, 4)) + [0.1])}",
    ))

fig2.update_layout(
    title=dict(text="🎯 Page Engagement Radar", font=dict(size=22, **FONT), x=0.5),
    polar=dict(
        radialaxis=dict(visible=True, range=[0, 100], gridcolor="#E8E8E8",
                        tickfont=dict(size=10, color=GRAY)),
        angularaxis=dict(gridcolor="#E8E8E8", tickfont=dict(size=11)),
        bgcolor=WHITE,
    ),
    plot_bgcolor=WHITE, paper_bgcolor=SOFT_BG,
    font=FONT, margin=dict(l=80, r=80, t=100, b=60), height=550, width=900,
    legend=dict(orientation="h", yanchor="bottom", y=-0.15, xanchor="center", x=0.5,
                bgcolor="rgba(255,255,255,0.8)", bordercolor="#ddd", borderwidth=1),
)
fig2.write_image("dashboard_engagement.png", scale=3)
fig2.write_html("dashboard_engagement.html")
print("[OK] Chart 2: Engagement Radar saved")


# ═══════════════════════════════════════════════════
# CHART 3: Feature Usage & Interaction Funnel
# ═══════════════════════════════════════════════════
features = ["Page Visit", "Scroll Past Hero", "Clicked a Feature",
            "Used Activity Finder", "Completed Quiz", "Used Chatbot"]
users_count = [18500, 14200, 9800, 6500, 4200, 3100]

fig3 = go.Figure(go.Funnel(
    y=features,
    x=users_count,
    textposition="inside",
    textinfo="value+percent initial",
    textfont=dict(size=14, color=WHITE),
    marker=dict(
        color=[GREEN, LIGHT_GREEN, TEAL, DARK_BLUE, ORANGE, "#E17055"],
        line=dict(width=0)
    ),
    connector=dict(line=dict(color="#DDD", width=1)),
))

fig3.update_layout(
    title=dict(text="🔽 User Interaction Funnel", font=dict(size=22, **FONT), x=0.5),
    plot_bgcolor=WHITE, paper_bgcolor=SOFT_BG,
    font=FONT, margin=dict(l=40, r=40, t=80, b=40), height=500, width=900,
    yaxis=dict(tickfont=dict(size=13)),
)
fig3.write_image("dashboard_funnel.png", scale=3)
fig3.write_html("dashboard_funnel.html")
print("[OK] Chart 3: Interaction Funnel saved")


# ═══════════════════════════════════════════════════
# CHART 4: Wellness Impact Metrics (Gauges)
# ═══════════════════════════════════════════════════
fig4 = make_subplots(
    rows=1, cols=4,
    specs=[[{"type": "indicator"}, {"type": "indicator"}, {"type": "indicator"}, {"type": "indicator"}]],
    horizontal_spacing=0.05
)

gauges = [
    ("Caregiver\nSatisfaction", 87, GREEN),
    ("Activity\nCompletion", 73, DARK_BLUE),
    ("Knowledge\nImprovement", 91, TEAL),
    ("Wellness Score\nIncrease", 68, ORANGE),
]

for i, (label, value, color) in enumerate(gauges):
    fig4.add_trace(go.Indicator(
        mode="gauge+number+delta",
        value=value,
        delta=dict(reference=value - 12, increasing=dict(color=GREEN)),
        number=dict(suffix="%", font=dict(size=28, color=color)),
        title=dict(text=label, font=dict(size=13, color=DARK_TEXT)),
        gauge=dict(
            axis=dict(range=[0, 100], tickwidth=1, tickcolor="#DDD", dtick=25),
            bar=dict(color=color, thickness=0.7),
            bgcolor=WHITE,
            borderwidth=1, bordercolor="#E8E8E8",
            steps=[
                dict(range=[0, 40], color="#FFF3E0"),
                dict(range=[40, 70], color="#FFF8E1"),
                dict(range=[70, 100], color="#E8F5E9"),
            ],
            threshold=dict(line=dict(color="#E17055", width=3), thickness=0.8, value=50),
        ),
    ), row=1, col=i + 1)

fig4.update_layout(
    title=dict(text="💚 Wellness Impact Scorecard", font=dict(size=22, **FONT), x=0.5),
    paper_bgcolor=SOFT_BG, height=350, width=950,
    font=FONT, margin=dict(l=30, r=30, t=80, b=20),
)
fig4.write_image("dashboard_impact.png", scale=3)
fig4.write_html("dashboard_impact.html")
print("[OK] Chart 4: Impact Gauges saved")


# ═══════════════════════════════════════════════════
# CHART 5: Chatbot Analytics (Donut + Bar combo)
# ═══════════════════════════════════════════════════
fig5 = make_subplots(
    rows=1, cols=2,
    specs=[[{"type": "pie"}, {"type": "bar"}]],
    subplot_titles=("Query Categories", "Weekly Chatbot Usage"),
    horizontal_spacing=0.12
)

# Donut chart - Query types
query_labels = ["Activities", "Medication", "Mental Health", "Safety", "Nutrition", "General"]
query_values = [320, 245, 280, 190, 210, 155]

fig5.add_trace(go.Pie(
    labels=query_labels, values=query_values,
    hole=0.55, textinfo="label+percent",
    textfont=dict(size=11),
    marker=dict(colors=PALETTE, line=dict(color=WHITE, width=2)),
    direction="clockwise", sort=False,
), row=1, col=1)

# Bar chart - Weekly usage
weeks = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"]
queries = [85, 120, 165, 210, 280, 345, 410, 490]
resolved = [72, 105, 148, 189, 258, 318, 385, 462]

fig5.add_trace(go.Bar(
    x=weeks, y=queries, name="Total Queries",
    marker=dict(color=DARK_BLUE, cornerradius=4), opacity=0.8
), row=1, col=2)

fig5.add_trace(go.Bar(
    x=weeks, y=resolved, name="Resolved",
    marker=dict(color=GREEN, cornerradius=4), opacity=0.8
), row=1, col=2)

fig5.update_layout(
    title=dict(text="🤖 AI Chatbot Performance", font=dict(size=22, **FONT), x=0.5),
    plot_bgcolor=WHITE, paper_bgcolor=SOFT_BG,
    font=FONT, margin=dict(l=40, r=40, t=100, b=40), height=450, width=950,
    legend=dict(orientation="h", yanchor="bottom", y=-0.12, xanchor="center", x=0.5,
                bgcolor="rgba(255,255,255,0.8)", bordercolor="#ddd", borderwidth=1),
    barmode="overlay",
)
fig5.update_yaxes(gridcolor="#E8E8E8", row=1, col=2)
fig5.write_image("dashboard_chatbot.png", scale=3)
fig5.write_html("dashboard_chatbot.html")
print("[OK] Chart 5: Chatbot Analytics saved")


# ═══════════════════════════════════════════════════
# CHART 6: Full Dashboard (Combined Overview)
# ═══════════════════════════════════════════════════
fig6 = make_subplots(
    rows=2, cols=3,
    specs=[
        [{"colspan": 2}, None, {"type": "pie"}],
        [{"type": "indicator"}, {"type": "indicator"}, {"type": "indicator"}],
    ],
    subplot_titles=(
        "Monthly Active Users", "Top Features Used",
        "Satisfaction", "Engagement Rate", "Avg Session"
    ),
    vertical_spacing=0.25, horizontal_spacing=0.08,
)

# Top left - Area chart
fig6.add_trace(go.Scatter(
    x=months, y=visitors, fill="tozeroy", name="Active Users",
    line=dict(color=GREEN, width=2, shape="spline"),
    fillcolor="rgba(92, 154, 27, 0.15)",
), row=1, col=1)

# Top right - Donut
feature_labels = ["Activity Finder", "Quiz", "Chatbot", "Checklists", "FAQs"]
feature_vals = [35, 22, 18, 15, 10]
fig6.add_trace(go.Pie(
    labels=feature_labels, values=feature_vals,
    hole=0.5, textinfo="label+percent", textfont=dict(size=10),
    marker=dict(colors=PALETTE[:5], line=dict(color=WHITE, width=2)),
), row=1, col=3)

# Bottom row - KPI indicators
kpis = [
    ("87%", "Caregiver Satisfaction", GREEN, 87, 75),
    ("4.2 min", "Avg Engagement Time", DARK_BLUE, 4.2, 3.1),
    ("3.8", "Pages Per Session", ORANGE, 3.8, 2.9),
]

for i, (display, title, color, val, ref) in enumerate(kpis):
    fig6.add_trace(go.Indicator(
        mode="number+delta",
        value=val,
        delta=dict(reference=ref, increasing=dict(color=GREEN), valueformat=".1f"),
        number=dict(font=dict(size=36, color=color), valueformat=".1f" if isinstance(val, float) else ".0%"),
        title=dict(text=title, font=dict(size=12)),
    ), row=2, col=i + 1)

fig6.update_layout(
    title=dict(text="📊 Humana CareGivers — Analytics Dashboard Overview",
               font=dict(size=20, **FONT), x=0.5),
    plot_bgcolor=WHITE, paper_bgcolor=SOFT_BG,
    font=FONT, margin=dict(l=30, r=30, t=90, b=30),
    height=650, width=1100,
    showlegend=False,
)
fig6.update_xaxes(gridcolor="#E8E8E8", row=1, col=1)
fig6.update_yaxes(gridcolor="#E8E8E8", row=1, col=1)
fig6.write_image("dashboard_overview.png", scale=3)
fig6.write_html("dashboard_overview.html")
print("[OK] Chart 6: Full Dashboard Overview saved")

print("\n[DONE] All 6 dashboard charts generated!")
print("   PNG files: dashboard_reach.png, dashboard_engagement.png, dashboard_funnel.png,")
print("              dashboard_impact.png, dashboard_chatbot.png, dashboard_overview.png")
print("   HTML files: Same names with .html (interactive versions)")
