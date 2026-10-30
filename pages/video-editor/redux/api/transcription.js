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
	tagTypes: [ 'Transcription', 'Captions' ],
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
		//
		// Accepts the attachment id on its own, or an object carrying the
		// optional multilingual / multi-audio controls:
		//   { attachmentID, language, trackIndex }
		// `language` is a BCP 47 tag (or "auto" / "multi" for Deepgram detection);
		// omit it to use the org/default language. `trackIndex` targets one audio
		// stream on a multi-audio asset; omit it to transcribe the default track.
		generateTranscription: builder.mutation( {
			query: ( arg ) => {
				const { attachmentID, language, trackIndex } =
					typeof arg === 'object' ? arg : { attachmentID: arg };
				const body = { attachment_id: attachmentID };
				if ( language ) {
					body.language = language;
				}
				if ( trackIndex !== undefined && trackIndex !== null ) {
					body.track_index = trackIndex;
				}
				return {
					url: `/godam/v1/transcription/generate`,
					method: 'POST',
					body,
				};
			},
			invalidatesTags: ( result, error, arg ) => {
				const id = typeof arg === 'object' ? arg.attachmentID : arg;
				return [
					{ type: 'Transcription', id },
					{ type: 'Captions', id },
				];
			},
		} ),

		// --- Caption-track management (SaaS api/captions.py) ---

		// List every caption track (generated + uploaded) for the attachment.
		listCaptions: builder.query( {
			query: ( attachmentID ) => ( {
				url: `/godam/v1/transcription/captions`,
				method: 'GET',
				params: { attachment_id: attachmentID },
			} ),
			providesTags: ( result, error, attachmentID ) => [ { type: 'Captions', id: attachmentID } ],
		} ),

		// Upload a new caption track from file text.
		// Arg: { attachmentID, content, language, label, kind, isDefault, sourceFormat }
		uploadCaption: builder.mutation( {
			query: ( { attachmentID, content, language, label, kind, isDefault, sourceFormat } ) => ( {
				url: `/godam/v1/transcription/captions`,
				method: 'POST',
				body: {
					attachment_id: attachmentID,
					content,
					language,
					label,
					kind,
					is_default: isDefault,
					source_format: sourceFormat,
				},
			} ),
			invalidatesTags: ( result, error, { attachmentID } ) => [
				{ type: 'Captions', id: attachmentID },
				// The server re-caches the default caption as the transcript.
				{ type: 'Transcription', id: attachmentID },
			],
		} ),

		// Replace or edit an existing caption track. Only pass the fields that change.
		// Arg: { attachmentID, captionID, content?, language?, label?, kind?, isDefault? }
		updateCaption: builder.mutation( {
			query: ( { attachmentID, captionID, content, language, label, kind, isDefault } ) => {
				const body = { attachment_id: attachmentID, caption_id: captionID };
				if ( content !== undefined ) {
					body.content = content;
				}
				if ( language !== undefined ) {
					body.language = language;
				}
				if ( label !== undefined ) {
					body.label = label;
				}
				if ( kind !== undefined ) {
					body.kind = kind;
				}
				if ( isDefault !== undefined ) {
					body.is_default = isDefault;
				}
				return {
					url: `/godam/v1/transcription/captions/update`,
					method: 'POST',
					body,
				};
			},
			invalidatesTags: ( result, error, { attachmentID } ) => [
				{ type: 'Captions', id: attachmentID },
				// The server re-caches the default caption as the transcript.
				{ type: 'Transcription', id: attachmentID },
			],
		} ),

		// Delete a caption track.
		// Arg: { attachmentID, captionID }
		deleteCaption: builder.mutation( {
			query: ( { attachmentID, captionID } ) => ( {
				url: `/godam/v1/transcription/captions/delete`,
				method: 'POST',
				body: { attachment_id: attachmentID, caption_id: captionID },
			} ),
			invalidatesTags: ( result, error, { attachmentID } ) => [
				{ type: 'Captions', id: attachmentID },
				// The server re-caches the default caption as the transcript.
				{ type: 'Transcription', id: attachmentID },
			],
		} ),

		// Mark a caption track as the default for playback.
		// Arg: { attachmentID, captionID }
		setDefaultCaption: builder.mutation( {
			query: ( { attachmentID, captionID } ) => ( {
				url: `/godam/v1/transcription/captions/default`,
				method: 'POST',
				body: { attachment_id: attachmentID, caption_id: captionID },
			} ),
			invalidatesTags: ( result, error, { attachmentID } ) => [
				{ type: 'Captions', id: attachmentID },
				// The server re-caches the default caption as the transcript.
				{ type: 'Transcription', id: attachmentID },
			],
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
	useListCaptionsQuery,
	useUploadCaptionMutation,
	useUpdateCaptionMutation,
	useDeleteCaptionMutation,
	useSetDefaultCaptionMutation,
} = transcriptionAPI;
