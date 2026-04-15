"""
A/B Testing Script — Humana CareGivers Website
@JDBilds

Tracks which variant (A or B) a user sees and records
button clicks / conversions per page.

Usage:
  - Import get_variant() into app.py and pass it to templates
  - Call record_event() from your /ask or any button endpoint
  - Run report() to see results
"""

import random
import json
import os
from datetime import datetime
from collections import defaultdict


DATA_FILE = "ab_results.json"


EXPERIMENTS = {
    "hero_cta_button": {
        "description": "Test CTA button text on homepage",
        "variant_a": "Get Started",
        "variant_b": "Support Your Loved One",
    },
    "chatbot_greeting": {
        "description": "Test opening chatbot message",
        "variant_a": "Hi! How can I help you today?",
        "variant_b": "Hello! Ask me anything about caregiving.",
    },
    "activity_section_heading": {
        "description": "Test heading on Activities page",
        "variant_a": "Explore Activities",
        "variant_b": "Find the Right Activity for Your Family",
    },
}


# ── Load / Save ──────────────────────────────────────────────
def _load():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    return {}


def _save(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)


# ── Core Functions ───────────────────────────────────────────
def get_variant(experiment_name: str, user_id: str) -> dict:
    """
    Assigns a user to variant A or B for a given experiment.
    Same user always gets the same variant (deterministic).

    Returns:
        { "variant": "A" or "B", "value": the variant text/content }
    """
    if experiment_name not in EXPERIMENTS:
        raise ValueError(f"Unknown experiment: {experiment_name}")

    # Deterministic assignment based on user_id hash
    variant = "A" if hash(user_id + experiment_name) % 2 == 0 else "B"
    exp = EXPERIMENTS[experiment_name]
    value = exp["variant_a"] if variant == "A" else exp["variant_b"]

    # Record the impression
    record_event(experiment_name, variant, "impression", user_id)

    return {"variant": variant, "value": value}


def record_event(experiment_name: str, variant: str, event_type: str, user_id: str = "anonymous"):
    """
    Records an event (impression or conversion) for an experiment.

    event_type: "impression" | "conversion" | "click"
    """
    data = _load()

    if experiment_name not in data:
        data[experiment_name] = {"A": defaultdict(int), "B": defaultdict(int)}

    # Ensure variant key exists
    if variant not in data[experiment_name]:
        data[experiment_name][variant] = {}

    # Increment the event counter
    data[experiment_name][variant][event_type] = (
        data[experiment_name][variant].get(event_type, 0) + 1
    )

    # Log the raw event
    if "events" not in data[experiment_name]:
        data[experiment_name]["events"] = []

    data[experiment_name]["events"].append({
        "user_id": user_id,
        "variant": variant,
        "event": event_type,
        "timestamp": datetime.now().isoformat()
    })

    _save(data)


def get_conversion_rate(experiment_name: str) -> dict:
    """
    Calculates conversion rate for both variants.

    Returns:
        { "A": { "impressions": x, "conversions": y, "rate": z% },
          "B": { ... } }
    """
    data = _load()

    if experiment_name not in data:
        return {"error": f"No data found for experiment: {experiment_name}"}

    results = {}
    for variant in ["A", "B"]:
        v_data = data[experiment_name].get(variant, {})
        impressions = v_data.get("impression", 0)
        conversions = v_data.get("conversion", 0)
        clicks = v_data.get("click", 0)
        rate = round((conversions / impressions * 100), 2) if impressions > 0 else 0

        results[variant] = {
            "impressions": impressions,
            "conversions": conversions,
            "clicks": clicks,
            "conversion_rate": f"{rate}%"
        }

    return results


def report():
    """
    Prints a full A/B test report for all experiments.
    """
    data = _load()

    if not data:
        print("No A/B test data recorded yet.")
        return

    print("\n" + "=" * 55)
    print("  HUMANA CAREGIVERS — A/B TEST REPORT")
    print(f"  Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 55)

    for exp_name, exp_config in EXPERIMENTS.items():
        print(f"\n EXPERIMENT: {exp_name}")
        print(f" Description: {exp_config['description']}")
        print(f" Variant A: \"{exp_config['variant_a']}\"")
        print(f" Variant B: \"{exp_config['variant_b']}\"")
        print(" " + "-" * 45)

        results = get_conversion_rate(exp_name)

        if "error" in results:
            print(f"  No data yet.")
            continue

        for variant, stats in results.items():
            print(f"  Variant {variant}:")
            print(f"    Impressions  : {stats['impressions']}")
            print(f"    Clicks       : {stats['clicks']}")
            print(f"    Conversions  : {stats['conversions']}")
            print(f"    Conv. Rate   : {stats['conversion_rate']}")

        # Declare winner
        rate_a = float(results["A"]["conversion_rate"].replace("%", ""))
        rate_b = float(results["B"]["conversion_rate"].replace("%", ""))

        if rate_a == rate_b == 0:
            print("\n  Winner : Not enough data yet.")
        elif rate_a > rate_b:
            print(f"\n  Winner : Variant A (+{round(rate_a - rate_b, 2)}% better)")
        elif rate_b > rate_a:
            print(f"\n  Winner : Variant B (+{round(rate_b - rate_a, 2)}% better)")
        else:
            print("\n  Winner : Tied — no clear winner.")

    print("\n" + "=" * 55 + "\n")


# ── Simulate Test Data (for demo/testing) ────────────────────
def simulate(n=100):
    """
    Simulates n users going through the experiments.
    Useful for testing before real traffic.
    """
    print(f"Simulating {n} users...")
    for i in range(n):
        user_id = f"user_{i}"
        for exp_name in EXPERIMENTS:
            result = get_variant(exp_name, user_id)
            # Variant B converts slightly better (simulated)
            convert_chance = 0.25 if result["variant"] == "B" else 0.15
            if random.random() < convert_chance:
                record_event(exp_name, result["variant"], "conversion", user_id)
            if random.random() < 0.4:
                record_event(exp_name, result["variant"], "click", user_id)

    print("Simulation complete.\n")
    report()


# ── Run ──────────────────────────────────────────────────────
if __name__ == "__main__":
    simulate(n=200)
