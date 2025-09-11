"""CORS utility functions for handling multiple frontend URLs."""
import os
from typing import Dict, Any, Optional


def get_cors_headers(origin: Optional[str] = None) -> Dict[str, str]:
    """
    Get CORS headers with proper origin handling for multiple frontend URLs.
    
    Args:
        origin: The requesting origin from the request headers
        
    Returns:
        Dictionary containing appropriate CORS headers
    """
    # Get allowed origins from environment variable
    frontend_urls = os.getenv("FRONTEND_URL", "*")
    
    if frontend_urls == "*":
        # Allow all origins
        allowed_origin = "*"
    else:
        # Parse comma-separated URLs
        allowed_urls = [url.strip() for url in frontend_urls.split(",")]
        
        # Check if the requesting origin is in the allowed list
        if origin and origin in allowed_urls:
            allowed_origin = origin
        else:
            # Default to first allowed URL if origin doesn't match
            allowed_origin = allowed_urls[0] if allowed_urls else "*"
    
    return {
        "Access-Control-Allow-Origin": allowed_origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true"
    }


def create_cors_response(
    status_code: int = 200,
    body: Any = None,
    origin: Optional[str] = None,
    additional_headers: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """
    Create a proper CORS response with headers.
    
    Args:
        status_code: HTTP status code
        body: Response body (will be JSON serialized if not a string)
        origin: The requesting origin from the request headers
        additional_headers: Additional headers to include
        
    Returns:
        AWS Lambda response format with CORS headers
    """
    import json
    
    headers = get_cors_headers(origin)
    if additional_headers:
        headers.update(additional_headers)
    
    # Handle body serialization
    if body is None:
        response_body = ""
    elif isinstance(body, str):
        response_body = body
    else:
        response_body = json.dumps(body, ensure_ascii=False)
    
    return {
        "statusCode": status_code,
        "headers": headers,
        "body": response_body
    }