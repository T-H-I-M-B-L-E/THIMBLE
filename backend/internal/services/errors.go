package services

// ServiceError lets a service surface a structured error code, message,
// and intended HTTP status to its handler without coupling to fiber.
type ServiceError struct {
	Status  int
	Code    string
	Message string
}

func (e *ServiceError) Error() string {
	if e.Message != "" {
		return e.Message
	}
	return e.Code
}

// NewError is the standard way to return a recognised application error.
// Pass status=0 for the default 500.
func NewError(status int, code, message string) *ServiceError {
	if status == 0 {
		status = 500
	}
	return &ServiceError{Status: status, Code: code, Message: message}
}
