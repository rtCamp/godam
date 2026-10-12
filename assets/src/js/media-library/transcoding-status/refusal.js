/**
 * Error codes for a job GoDAM Central refused (see rtgodam_record_job_refusal()): the
 * source file failed its checks, or the licence, storage or site isn't allowed.
 */
const REFUSAL_CODES = [ 'preflight_failed', 'job_refused' ];

/**
 * Whether a failure is Central refusing the job.
 *
 * @param {string} errorCode The attachment's transcoding error code.
 *
 * @return {boolean} True for a refusal.
 */
export const isRefusal = ( errorCode ) => REFUSAL_CODES.includes( errorCode );
