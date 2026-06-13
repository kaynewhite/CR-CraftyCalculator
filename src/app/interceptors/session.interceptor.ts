import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const sessionInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && err.error?.code === 'SESSION_INVALIDATED') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.navigate(['/login'], {
          queryParams: { reason: 'session_invalidated' }
        });
      }
      return throwError(() => err);
    })
  );
};
