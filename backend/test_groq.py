import os
from groq import Groq
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    print("❌ Error: GROQ_API_KEY not found in .env file")
    exit(1)

client = Groq(api_key=api_key)

try:
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "system",
                "content": "You are CyberSentinel AI, an expert cybersecurity analyst."
            },
            {
                "role": "user", 
                "content": "Analyze this: Port 22 (SSH) is open on a server. What are the risks?"
            }
        ],
        max_tokens=500,
        temperature=0.3
    )

    print("OK: Groq API works!")
    print("\nAnalysis Result:")
    print(response.choices[0].message.content)
except Exception as e:
    print(f"Error during API call: {e}")
