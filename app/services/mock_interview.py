import json
import logging
from app.config import settings

logger = logging.getLogger(__name__)

_client = None

def _get_client():
    global _client
    if _client is not None:
        return _client
    from google import genai
    api_key = settings.gemini_api_key
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured.")
    _client = genai.Client(api_key=api_key)
    return _client

def generate_mock_questions(job_title: str, job_description: str, candidate_skills: str, num_questions: int = 1, language: str = "en") -> list[dict]:
    """
    Generate the FIRST interview question based on the job and candidate profile.
    """
    client = _get_client()
    from google.genai import types

    prompt = f"""
    You are an expert technical interviewer.
    Generate the FIRST interview question for a candidate applying for the role of "{job_title}".
    
    Job Description context:
    {job_description}
    
    Candidate Skills context:
    {candidate_skills}

    Return the result ONLY as a JSON array containing exactly 1 object with this exact structure:
    [
      {{
        "question": "The interview question text",
        "hint": "A short hint to help the candidate if they get stuck"
      }}
    ]
    Do not include markdown blocks or any other text.
    
    IMPORTANT: You must generate the question and hint in {"Vietnamese" if language == "vi" else "English"}.
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.7,
                response_mime_type="application/json"
            )
        )
        
        text = response.text
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
            
        data = json.loads(text.strip())
        return data
    except Exception as e:
        logger.error(f"Error generating mock questions: {e}")
        # Fallback questions
        return [
            {"question": f"Could you walk me through your experience relevant to a {job_title} role?", "hint": "Focus on past projects and your core tech stack."},
            {"question": "What is the most challenging technical problem you've solved recently?", "hint": "Use the STAR method: Situation, Task, Action, Result."},
            {"question": "How do you ensure code quality and maintainability in your work?", "hint": "Mention testing, code reviews, or design patterns."}
        ]

def evaluate_and_probe_mock_answer(current_question: str, current_answer: str, history: list[dict], max_questions: int = 3, language: str = "en") -> dict:
    """
    Evaluate the candidate's answer and dynamically generate the next follow-up question based on the history.
    """
    client = _get_client()
    from google.genai import types

    history_text = ""
    for idx, item in enumerate(history):
        history_text += f"\nQ{idx+1}: {item.get('question')}\nA{idx+1}: {item.get('answer')}\n"

    is_last_question = len(history) + 1 >= max_questions

    prompt = f"""
    You are an expert technical interviewer. Evaluate the candidate's latest answer.
    
    Previous Q&A History:
    {history_text if history_text else "None (This is the first question)"}
    
    Current Question: {current_question}
    Candidate Answer: {current_answer}
    
    Tasks:
    1. Evaluate the Candidate Answer to the Current Question. Score it out of 100 and provide constructive feedback.
    2. Since you have asked {len(history) + 1} questions so far, and the limit is {max_questions}:
       - If the limit has been reached ({is_last_question}), do NOT generate a next question. Set next_question and next_hint to null.
       - If the limit is NOT reached, dynamically generate the NEXT follow-up question based on their answer. If they answered poorly, ask a probing/easier question. If they answered well, ask a harder follow-up or move to a new topic.
    
    Evaluate the answer and return ONLY a valid JSON object with this exact structure:
    {{
      "score": <integer from 0 to 100 representing the quality of the answer>,
      "feedback": "<string containing constructive feedback on what was good and how to improve>",
      "next_question": "<string containing the next question, or null if finished>",
      "next_hint": "<string containing a hint for the next question, or null if finished>"
    }}
    Do not include markdown blocks or any other text.
    
    IMPORTANT: You must generate the feedback, next_question, and next_hint in {"Vietnamese" if language == "vi" else "English"}.
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.4,
                response_mime_type="application/json"
            )
        )
        
        text = response.text
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
            
        data = json.loads(text.strip())
        return data
    except Exception as e:
        logger.error(f"Error evaluating mock answer: {e}")
        return {
            "score": 50,
            "feedback": "We couldn't evaluate your answer due to a server error.",
            "next_question": None,
            "next_hint": None
        }
