/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const restURL = window.godamRestRoute?.url || window.wpApiSettings?.root || '/wp-json/';

/**
 * RTK Query API for the AI transcript feature.
 *
 * All endpoints are same-origin WordPress REST proxies (under `godam/v1`) that
 * forward to the GoDAM SaaS using the server-side licence key — the React app
 * never sees the API key. See `class-transcription.php` for the PHP side.
 */
export const transcriptionAPI = createApi( {
	reducerPath: 'transcriptionAPI',
	baseQuery: fetchBaseQuery( {
		baseUrl: restURL,
		prepareHeaders: ( headers ) => {
			headers.set( 'X-WP-Nonce', window.videoData.nonce );
			return headers;
		},
	} ),
	tagTypes: [ 'Transcription' ],
	endpoints: ( builder ) => ( {
		// Current transcript status / path for an attachment. Polled while a
		// job is in progress.
		getTranscription: builder.query( {
			query: ( attachmentID ) => ( {
				url: `/godam/v1/transcription`,
				method: 'GET',
				params: { attachment_id: attachmentID },
			} ),
			providesTags: ( result, error, attachmentID ) => [ { type: 'Transcription', id: attachmentID } ],
		} ),

		// Kick off (or re-run) AI transcription for the attachment's transcoding job.
		generateTranscription: builder.mutation( {
			query: ( attachmentID ) => ( {
				url: `/godam/v1/transcription/generate`,
				method: 'POST',
				body: { attachment_id: attachmentID },
			} ),
			invalidatesTags: ( result, error, attachmentID ) => [ { type: 'Transcription', id: attachmentID } ],
		} ),

		// Attach an existing caption file (.vtt / .srt) as the transcript.
		uploadTranscription: builder.mutation( {
			query: ( { attachmentID, url } ) => ( {
				url: `/godam/v1/transcription/upload`,
				method: 'POST',
				body: { attachment_id: attachmentID, url },
			} ),
			invalidatesTags: ( result, error, { attachmentID } ) => [ { type: 'Transcription', id: attachmentID } ],
		} ),

		// Remove the transcript from the attachment.
		deleteTranscription: builder.mutation( {
			query: ( attachmentID ) => ( {
				url: `/godam/v1/transcription`,
				method: 'DELETE',
				body: { attachment_id: attachmentID },
			} ),
			invalidatesTags: ( result, error, attachmentID ) => [ { type: 'Transcription', id: attachmentID } ],
		} ),
	} ),
} );

export const {
	useGetTranscriptionQuery,
	useGenerateTranscriptionMutation,
	useUploadTranscriptionMutation,
	useDeleteTranscriptionMutation,
} = transcriptionAPI;
