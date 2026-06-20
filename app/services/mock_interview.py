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

def generate_mock_questions(job_title: str, job_description: str, candidate_skills: str, num_questions: int = 3) -> list[dict]:
    """
    Generate interview questions based on the job and candidate profile.
    """
    client = _get_client()
    from google.genai import types

    prompt = f"""
    You are an expert technical interviewer.
    Generate exactly {num_questions} interview questions for a candidate applying for the role of "{job_title}".
    
    Job Description context:
    {job_description}
    
    Candidate Skills context:
    {candidate_skills}

    Return the result ONLY as a JSON array of objects with this exact structure:
    [
      {{
        "question": "The interview question text",
        "hint": "A short hint to help the candidate if they get stuck"
      }}
    ]
    Do not include markdown blocks or any other text.
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

def evaluate_mock_answer(question: str, answer: str) -> dict:
    """
    Evaluate the candidate's answer to a mock interview question.
    """
    client = _get_client()
    from google.genai import types

    prompt = f"""
    You are an expert technical interviewer. Evaluate the candidate's answer to the following question.
    
    Question: {question}
    Candidate Answer: {answer}
    
    Evaluate the answer and return ONLY a valid JSON object with this exact structure:
    {{
      "score": <integer from 0 to 100 representing the quality of the answer>,
      "feedback": "<string containing constructive feedback on what was good and how to improve>"
    }}
    Do not include markdown blocks or any other text.
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
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
            "feedback": "We couldn't evaluate your answer due to a server error. However, ensure your answers are detailed and follow the STAR method."
        }
