/**
 * WordPress dependencies
 */
import { useEffect, useRef, useState } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { ERROR_TYPE } from './enums';

/**
 * Error code to show a site owner (and quote to support) for a failed analytics read.
 *
 * @param {Object} data  RTK Query `data` (the plugin route answers some failures with a 200 body).
 * @param {Object} error RTK Query `error`.
 * @return {string} The service's errorType, else the HTTP status, else ''.
 */
export const getAnalyticsErrorCode = ( data, error ) => {
	const code = data?.errorType || error?.data?.errorType || error?.status;

	return code ? String( code ) : '';
};

/**
 * Whether the analytics service is unreachable for a page's primary query, held
 * steady while "Try again" is in flight.
 *
 * RTK Query clears `isError` the moment a refetch starts, so reading it directly
 * would hide the outage card for the length of every retry and flash an empty
 * page. The answer only changes once a request settles.
 *
 * @param {Object}  query
 * @param {boolean} query.enabled    Connected with a valid key and not skipped.
 * @param {boolean} query.isError    RTK Query `isError`.
 * @param {boolean} query.isFetching RTK Query `isFetching`.
 * @param {Object}  query.data       RTK Query `data`.
 * @param {Object}  query.error      RTK Query `error`.
 * @return {{unreachable: boolean, checking: boolean, lastChecked: ?Date, errorCode: string}} Outage state.
 */
const useAnalyticsOutage = ( { enabled, isError, isFetching, data, error } ) => {
	const failed = !! enabled && ( !! isError || data?.errorType === ERROR_TYPE.MICROSERVICE_ERROR );

	// Last settled answer; kept while a request is in flight.
	const settled = useRef( false );
	if ( ! isFetching ) {
		settled.current = failed;
	}
	const unreachable = isFetching ? settled.current : failed;

	const [ lastChecked, setLastChecked ] = useState( null );
	const [ errorCode, setErrorCode ] = useState( '' );

	useEffect( () => {
		if ( isFetching || ! failed ) {
			return;
		}
		setLastChecked( new Date() );
		setErrorCode( getAnalyticsErrorCode( data, error ) );
	}, [ isFetching, failed, data, error ] );

	return {
		unreachable,
		checking: unreachable && !! isFetching,
		lastChecked,
		errorCode,
	};
};

export default useAnalyticsOutage;
