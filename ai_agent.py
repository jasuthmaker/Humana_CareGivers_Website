import random

class HumanaAI:
    def __init__(self):
        # You can later initialize your ML model or API clients here
        self.kb = {
            "activity": "🏃 Activities for elders: Wellness walks, heritage cooking, or board games.",
            "medication": "💊 Tips: Use a pill organizer and set phone reminders.",
            "mental": "🧠 Mental health: Regular social visits and music therapy lift moods.",
            "support": "📞 Contact Humana Support: 1-800-457-4708.",
            "safety": "🏠 Home safety: Remove loose rugs and install grab bars in showers.",
            "nutrition": "🥗 Nutrition: Focus on colorful plates and stay hydrated."
        }
        self.fallbacks = [
            "That's a great question! Let me look into that for you.",
            "I'm here to help. Could you tell me more about that?",
            "Humana's support team can definitely help with that at 1-800-WELLNESS."
        ]

    def get_response(self, user_input):
        """
        Main logic for the AI feedback. 
        You can replace this with a call to a transformer model or an LLM API.
        """
        text = user_input.lower()
        
        # Simple keyword matching for the 'start' version
        for key, reply in self.kb.items():
            if key in text:
                return reply
        
        return random.choice(self.fallbacks)
