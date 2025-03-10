/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const restURL = window.godamRestRoute.url || '';
function pathJoin( parts, sep = '/' ) {
	return parts
		.map( ( part, index ) => {
			// Don't modify 'http://' or 'https://' at the beginning
			if ( index === 0 ) {
				return part.replace( new RegExp( sep + '+$', 'g' ), '' ); // Remove trailing `/`
			}
			return part.replace( new RegExp( '^' + sep + '+|' + sep + '+$', 'g' ), '' ); // Trim leading and trailing `/`
		} )
		.join( sep );
}

export const storageAPI = createApi( {
	reducerPath: 'storageApi',
	baseQuery: fetchBaseQuery( { baseUrl: pathJoin( [ restURL, '/godam/v1/settings/' ] ) } ),
	endpoints: ( builder ) => ( {
		getAWSSettings: builder.query( {
			query: () => ( {
				url: 'aws',
				headers: {
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
			} ),
		} ),
		getBuckets: builder.query( {
			query: () => ( {
				url: 'get-buckets',
				headers: {
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
			} ),
		} ),
		saveAWSSettings: builder.mutation( {
			query: ( settings ) => ( {
				url: 'aws',
				method: 'POST',
				headers: {
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
				body: settings,
			} ),
		} ),
		validateCredentials: builder.query( {
			query: () => ( {
				url: 'validate-credentials',
				method: 'GET',
				headers: {
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
			} ),
		} ),
	} ),
} );

export const { useGetAWSSettingsQuery, useGetBucketsQuery, useSaveAWSSettingsMutation, useValidateCredentialsQuery } = storageAPI;
