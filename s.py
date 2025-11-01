import os, requests

def summarize_text_with_gemini(text):
    api_key = os.getenv("api_key")  # same key that works in Postman
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"

    payload = {
        "contents": [{"parts": [{"text": f"Summarize the following text:\n{text}"}]}]
    }

    headers = {"Content-Type": "application/json"}
    response = requests.post(url, headers=headers, json=payload)

    if response.status_code == 200:
        return response.json()["candidates"][0]["content"]["parts"][0]["text"]
    else:
        print("Gemini API error:", response.text)
        return None
