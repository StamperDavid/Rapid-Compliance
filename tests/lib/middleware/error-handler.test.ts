/**
 * Unit Tests for Error Handler Middleware
 *
 * Covers: ErrorCode enum, createErrorResponse, errors helpers, withErrorHandler wrapper.
 *
 * Architecture note on mocking:
 * The next/jest SWC transformer does NOT hoist jest.mock() calls the way
 * babel-jest does.  This means that when `error-handler.ts` is compiled and
 * loaded, its top-level `require("@sentry/nextjs")` executes before
 * `jest.mock(...)` is registered, so the module gets the real Sentry instance.
 *
 * We work around this for the withErrorHandler Sentry tests by using
 * `jest.isolateModules()`, which creates a fresh module registry context.
 * Inside that context we register the mock FIRST, then require the module —
 * guaranteeing the mock is in place when the module initialises.
 *
 * All other tests import the module at the top level (which is fine for
 * testing createErrorResponse / errors helpers since those do not call Sentry).
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Top-level mocks for non-Sentry dependencies.
// These are safe at the top level since the logger is not affected by load order.
// ---------------------------------------------------------------------------

jest.mock('@/lib/logger/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Provide a no-op for the top-level import of @sentry/nextjs (used when the
// module is loaded without isolation).  The real interception happens inside
// jest.isolateModules() in the withErrorHandler tests.
jest.mock('@sentry/nextjs', () => ({
  __esModule: true,
  captureException: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Module under test — top-level import for non-Sentry tests.
// The `APIError` type is imported in the same statement to avoid the
// no-duplicate-imports lint rule.
// ---------------------------------------------------------------------------

import {
  ErrorCode,
  createErrorResponse,
  errors,
  type APIError,
} from '@/lib/middleware/error-handler';

// ---------------------------------------------------------------------------
// 1. ErrorCode enum
// ---------------------------------------------------------------------------

describe('ErrorCode enum', () => {
  it('has all expected client-error codes', () => {
    expect(ErrorCode.BAD_REQUEST).toBe('BAD_REQUEST');
    expect(ErrorCode.UNAUTHORIZED).toBe('UNAUTHORIZED');
    expect(ErrorCode.FORBIDDEN).toBe('FORBIDDEN');
    expect(ErrorCode.NOT_FOUND).toBe('NOT_FOUND');
    expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    expect(ErrorCode.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('has all expected server-error codes', () => {
    expect(ErrorCode.INTERNAL_SERVER_ERROR).toBe('INTERNAL_SERVER_ERROR');
    expect(ErrorCode.DATABASE_ERROR).toBe('DATABASE_ERROR');
    expect(ErrorCode.EXTERNAL_SERVICE_ERROR).toBe('EXTERNAL_SERVICE_ERROR');
  });

  it('exposes exactly nine distinct string values', () => {
    const values = Object.values(ErrorCode);
    expect(values).toHaveLength(9);
    // All values are unique strings.
    expect(new Set(values).size).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// 2. createErrorResponse — string input
// ---------------------------------------------------------------------------

describe('createErrorResponse with a string error', () => {
  it('returns the supplied HTTP status code', () => {
    const response = createErrorResponse('Bad input', 400, ErrorCode.BAD_REQUEST);
    expect(response.status).toBe(400);
  });

  it('sets success:false in the body', async () => {
    const response = createErrorResponse('Bad input', 400, ErrorCode.BAD_REQUEST);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it('sets the error message in the body', async () => {
    const response = createErrorResponse('Bad input', 400, ErrorCode.BAD_REQUEST);
    const body = await response.json();
    expect(body.error).toBe('Bad input');
  });

  it('sets the error code in the body', async () => {
    const response = createErrorResponse('Bad input', 400, ErrorCode.BAD_REQUEST);
    const body = await response.json();
    expect(body.code).toBe(ErrorCode.BAD_REQUEST);
  });

  it('defaults status to 500 when no statusCode argument is given', () => {
    const response = createErrorResponse('Unexpected');
    expect(response.status).toBe(500);
  });

  it('forwards optional details into the body', async () => {
    const details = { field: 'email', issue: 'required' };
    const response = createErrorResponse('Validation failed', 400, ErrorCode.VALIDATION_ERROR, details);
    const body = await response.json();
    expect(body.details).toEqual(details);
  });

  it('sets details to undefined when none are supplied', async () => {
    const response = createErrorResponse('Something went wrong', 400, ErrorCode.BAD_REQUEST);
    const body = await response.json();
    expect(body.details).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3. createErrorResponse — Error object input
// ---------------------------------------------------------------------------

describe('createErrorResponse with an Error object', () => {
  it('uses Error.message as the body error string', async () => {
    const err = new Error('Something exploded');
    const response = createErrorResponse(err, 500);
    const body = await response.json();
    expect(body.error).toBe('Something exploded');
  });

  it('defaults the code to INTERNAL_SERVER_ERROR when no code is given', async () => {
    const err = new Error('Boom');
    const response = createErrorResponse(err, 500);
    const body = await response.json();
    expect(body.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
  });

  it('uses the explicitly supplied code when one is given', async () => {
    const err = new Error('DB failure');
    const response = createErrorResponse(err, 500, ErrorCode.DATABASE_ERROR);
    const body = await response.json();
    expect(body.code).toBe(ErrorCode.DATABASE_ERROR);
  });

  it('returns status 500 for server-level Error objects', () => {
    const err = new Error('crash');
    const response = createErrorResponse(err, 500);
    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// 4. createErrorResponse — APIError object input
// ---------------------------------------------------------------------------

describe('createErrorResponse with an APIError object', () => {
  it('uses statusCode from the APIError', () => {
    const apiError: APIError = {
      message: 'Not found',
      code: ErrorCode.NOT_FOUND,
      statusCode: 404,
    };
    const response = createErrorResponse(apiError);
    expect(response.status).toBe(404);
  });

  it('uses code from the APIError', async () => {
    const apiError: APIError = {
      message: 'Not found',
      code: ErrorCode.NOT_FOUND,
      statusCode: 404,
    };
    const response = createErrorResponse(apiError);
    const body = await response.json();
    expect(body.code).toBe(ErrorCode.NOT_FOUND);
  });

  it('uses message from the APIError', async () => {
    const apiError: APIError = {
      message: 'Not found',
      code: ErrorCode.NOT_FOUND,
      statusCode: 404,
    };
    const response = createErrorResponse(apiError);
    const body = await response.json();
    expect(body.error).toBe('Not found');
  });

  it('includes details from the APIError', async () => {
    const apiError: APIError = {
      message: 'Validation failed',
      code: ErrorCode.VALIDATION_ERROR,
      statusCode: 400,
      details: { field: 'name' },
    };
    const response = createErrorResponse(apiError);
    const body = await response.json();
    expect(body.details).toEqual({ field: 'name' });
  });

  it('falls back to the caller-supplied statusCode when APIError.statusCode is 0', () => {
    // statusCode of 0 is falsy, so the fallback parameter should be used.
    const apiError: APIError = {
      message: 'Edge case',
      statusCode: 0,
    };
    const response = createErrorResponse(apiError, 422);
    expect(response.status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// 5–13. errors helpers
// ---------------------------------------------------------------------------

describe('errors.badRequest', () => {
  it('returns HTTP 400', () => {
    const response = errors.badRequest('Invalid input');
    expect(response.status).toBe(400);
  });

  it('sets success:false', async () => {
    const body = await errors.badRequest('Invalid input').json();
    expect(body.success).toBe(false);
  });

  it('sets code to BAD_REQUEST', async () => {
    const body = await errors.badRequest('Invalid input').json();
    expect(body.code).toBe(ErrorCode.BAD_REQUEST);
  });

  it('includes the supplied error message', async () => {
    const body = await errors.badRequest('Invalid input').json();
    expect(body.error).toBe('Invalid input');
  });

  it('forwards optional details', async () => {
    const body = await errors.badRequest('Bad', { param: 'id' }).json();
    expect(body.details).toEqual({ param: 'id' });
  });
});

describe('errors.unauthorized', () => {
  it('returns HTTP 401', () => {
    expect(errors.unauthorized().status).toBe(401);
  });

  it('defaults to message "Unauthorized"', async () => {
    const body = await errors.unauthorized().json();
    expect(body.error).toBe('Unauthorized');
  });

  it('accepts a custom message', async () => {
    const body = await errors.unauthorized('Token expired').json();
    expect(body.error).toBe('Token expired');
  });

  it('sets code to UNAUTHORIZED', async () => {
    const body = await errors.unauthorized().json();
    expect(body.code).toBe(ErrorCode.UNAUTHORIZED);
  });
});

describe('errors.forbidden', () => {
  it('returns HTTP 403', () => {
    expect(errors.forbidden().status).toBe(403);
  });

  it('defaults to message "Forbidden"', async () => {
    const body = await errors.forbidden().json();
    expect(body.error).toBe('Forbidden');
  });

  it('accepts a custom message', async () => {
    const body = await errors.forbidden('Insufficient role').json();
    expect(body.error).toBe('Insufficient role');
  });

  it('sets code to FORBIDDEN', async () => {
    const body = await errors.forbidden().json();
    expect(body.code).toBe(ErrorCode.FORBIDDEN);
  });
});

describe('errors.notFound', () => {
  it('returns HTTP 404', () => {
    expect(errors.notFound().status).toBe(404);
  });

  it('defaults to message "Resource not found"', async () => {
    const body = await errors.notFound().json();
    expect(body.error).toBe('Resource not found');
  });

  it('accepts a custom resource name in the message', async () => {
    const body = await errors.notFound('User not found').json();
    expect(body.error).toBe('User not found');
  });

  it('sets code to NOT_FOUND', async () => {
    const body = await errors.notFound().json();
    expect(body.code).toBe(ErrorCode.NOT_FOUND);
  });
});

describe('errors.validation', () => {
  it('returns HTTP 400', () => {
    expect(errors.validation('Invalid schema').status).toBe(400);
  });

  it('sets code to VALIDATION_ERROR', async () => {
    const body = await errors.validation('Invalid schema').json();
    expect(body.code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it('includes the supplied message', async () => {
    const body = await errors.validation('Email is required').json();
    expect(body.error).toBe('Email is required');
  });

  it('includes validation details when provided', async () => {
    const details = { field: 'email', constraint: 'required' };
    const body = await errors.validation('Validation failed', details).json();
    expect(body.details).toEqual(details);
  });

  it('omits details when none are provided', async () => {
    const body = await errors.validation('Validation failed').json();
    expect(body.details).toBeUndefined();
  });
});

describe('errors.rateLimit', () => {
  it('returns HTTP 429', () => {
    expect(errors.rateLimit().status).toBe(429);
  });

  it('defaults to message "Rate limit exceeded"', async () => {
    const body = await errors.rateLimit().json();
    expect(body.error).toBe('Rate limit exceeded');
  });

  it('accepts a custom message', async () => {
    const body = await errors.rateLimit('Too many requests — try again in 60 s').json();
    expect(body.error).toBe('Too many requests — try again in 60 s');
  });

  it('sets code to RATE_LIMIT_EXCEEDED', async () => {
    const body = await errors.rateLimit().json();
    expect(body.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
  });
});

describe('errors.internal', () => {
  it('returns HTTP 500', () => {
    expect(errors.internal().status).toBe(500);
  });

  it('defaults to message "Internal server error"', async () => {
    const body = await errors.internal().json();
    expect(body.error).toBe('Internal server error');
  });

  it('accepts a custom string message', async () => {
    const body = await errors.internal('Service unavailable').json();
    expect(body.error).toBe('Service unavailable');
  });

  it('uses the Error object message when an Error is supplied', async () => {
    const err = new Error('Disk full');
    const body = await errors.internal('Internal server error', err).json();
    // When an Error is passed the handler path uses the Error object, not the message string.
    expect(body.error).toBe('Disk full');
  });

  it('sets code to INTERNAL_SERVER_ERROR', async () => {
    const body = await errors.internal().json();
    expect(body.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
  });
});

describe('errors.database', () => {
  it('returns HTTP 500', () => {
    expect(errors.database('Query failed').status).toBe(500);
  });

  it('sets code to DATABASE_ERROR', async () => {
    const body = await errors.database('Query failed').json();
    expect(body.code).toBe(ErrorCode.DATABASE_ERROR);
  });

  it('uses the string message when no Error object is given', async () => {
    const body = await errors.database('Connection refused').json();
    expect(body.error).toBe('Connection refused');
  });

  it('uses the Error.message when an Error is supplied', async () => {
    const err = new Error('Timeout after 5000 ms');
    const body = await errors.database('Connection refused', err).json();
    expect(body.error).toBe('Timeout after 5000 ms');
  });
});

describe('errors.externalService', () => {
  it('returns HTTP 502', () => {
    expect(errors.externalService('Stripe').status).toBe(502);
  });

  it('sets code to EXTERNAL_SERVICE_ERROR', async () => {
    const body = await errors.externalService('Stripe').json();
    expect(body.code).toBe(ErrorCode.EXTERNAL_SERVICE_ERROR);
  });

  it('includes the service name in the default error message', async () => {
    const body = await errors.externalService('Twilio').json();
    expect(body.error).toContain('Twilio');
  });

  it('uses Error.message when an Error object is supplied', async () => {
    const err = new Error('503 from SendGrid');
    const body = await errors.externalService('SendGrid', err).json();
    expect(body.error).toBe('503 from SendGrid');
  });
});

// ---------------------------------------------------------------------------
// 14. withErrorHandler wrapper
//
// The next/jest SWC transformer does NOT hoist jest.mock() calls.  The module
// under test has `const _nextjs = require("@sentry/nextjs")` at its top-level,
// which runs BEFORE any jest.mock() registered later in module scope.  To
// intercept that require we use jest.isolateModules(), which creates a fresh
// module registry.  Inside that context we register the Sentry mock first,
// then require the module — guaranteeing the mock is in place at load time.
// ---------------------------------------------------------------------------

describe('withErrorHandler', () => {
  let withErrorHandlerFn: typeof import('@/lib/middleware/error-handler').withErrorHandler;
  let ErrorCodeEnum: typeof import('@/lib/middleware/error-handler').ErrorCode;
  const isolatedSentryCalls: Array<{ error: unknown; extra: unknown }> = [];

  beforeEach(() => {
    isolatedSentryCalls.length = 0;

    jest.isolateModules(() => {
      // Register Sentry mock BEFORE requiring the module under test so that
      // require("@sentry/nextjs") inside the module hits our stub.
      jest.mock('@sentry/nextjs', () => ({
        __esModule: true,
        captureException: (error: unknown, extra: unknown) => {
          isolatedSentryCalls.push({ error, extra });
        },
      }));
      jest.mock('@/lib/logger/logger', () => ({
        logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
      }));

      // Dynamic require inside isolateModules — this is the documented pattern
      // for obtaining a freshly-mocked module reference.
      // The cast to the module type gives us correct TypeScript inference.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@/lib/middleware/error-handler') as typeof import('@/lib/middleware/error-handler');
      withErrorHandlerFn = mod.withErrorHandler;
      ErrorCodeEnum = mod.ErrorCode;
    });
  });

  it('returns the handler response when no error is thrown', async () => {
    const { NextResponse } = await import('next/server');
    const handler = jest.fn((_req: NextRequest) =>
      Promise.resolve(NextResponse.json({ success: true }, { status: 200 }))
    );
    const wrapped = withErrorHandlerFn(handler);
    const request = new NextRequest('http://localhost/api/test', { method: 'GET' });

    const response = await wrapped(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it('calls the inner handler with the original request', async () => {
    const { NextResponse } = await import('next/server');
    const handler = jest.fn((_req: NextRequest) =>
      Promise.resolve(NextResponse.json({}, { status: 200 }))
    );
    const wrapped = withErrorHandlerFn(handler);
    const request = new NextRequest('http://localhost/api/test', { method: 'POST' });

    await wrapped(request);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]).toBe(request);
  });

  it('returns a 500 response when the handler throws', async () => {
    const handler = jest.fn((_req: NextRequest) =>
      Promise.reject(new Error('Something went wrong'))
    );
    const wrapped = withErrorHandlerFn(handler);
    const request = new NextRequest('http://localhost/api/test', { method: 'GET' });

    const response = await wrapped(request);
    expect(response.status).toBe(500);
  });

  it('sets success:false in the 500 error body', async () => {
    const handler = jest.fn((_req: NextRequest) =>
      Promise.reject(new Error('Crash'))
    );
    const wrapped = withErrorHandlerFn(handler);
    const request = new NextRequest('http://localhost/api/test', { method: 'GET' });

    const body = await (await wrapped(request)).json();
    expect(body.success).toBe(false);
  });

  it('sets code to INTERNAL_SERVER_ERROR in the error body', async () => {
    const handler = jest.fn((_req: NextRequest) =>
      Promise.reject(new Error('Crash'))
    );
    const wrapped = withErrorHandlerFn(handler);
    const request = new NextRequest('http://localhost/api/test', { method: 'GET' });

    const body = await (await wrapped(request)).json();
    expect(body.code).toBe(ErrorCodeEnum.INTERNAL_SERVER_ERROR);
  });

  it('calls Sentry.captureException when the handler throws', async () => {
    const thrownError = new Error('Unhandled crash');
    const handler = jest.fn((_req: NextRequest) =>
      Promise.reject(thrownError)
    );
    const wrapped = withErrorHandlerFn(handler);
    const request = new NextRequest('http://localhost/api/test', { method: 'GET' });

    await wrapped(request);

    expect(isolatedSentryCalls).toHaveLength(1);
    expect(isolatedSentryCalls[0].error).toBe(thrownError);
    expect(isolatedSentryCalls[0].extra).toEqual(
      expect.objectContaining({
        tags: expect.objectContaining({ method: 'GET' }),
      })
    );
  });

  it('does not call Sentry when no error is thrown', async () => {
    const { NextResponse } = await import('next/server');
    const handler = jest.fn((_req: NextRequest) =>
      Promise.resolve(NextResponse.json({}, { status: 200 }))
    );
    const wrapped = withErrorHandlerFn(handler);
    const request = new NextRequest('http://localhost/api/test', { method: 'GET' });

    await wrapped(request);
    expect(isolatedSentryCalls).toHaveLength(0);
  });

  it('forwards the optional context argument to the handler', async () => {
    const { NextResponse } = await import('next/server');
    const handler = jest.fn((_req: NextRequest, _ctx?: Record<string, unknown>) =>
      Promise.resolve(NextResponse.json({}, { status: 200 }))
    );
    const wrapped = withErrorHandlerFn(handler);
    const request = new NextRequest('http://localhost/api/test', { method: 'GET' });
    const context = { params: { id: '42' } };

    await wrapped(request, context);
    expect(handler).toHaveBeenCalledWith(request, context);
  });
});
