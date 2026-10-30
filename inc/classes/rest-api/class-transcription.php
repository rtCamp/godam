<?php
/**
 * REST API class for the AI transcript feature in the video editor.
 *
 * Provides same-origin proxies the React editor can call (with a WP nonce) so
 * the GoDAM SaaS licence key never reaches the browser. The transcript itself
 * is stored on the attachment as the `rtgodam_transcript_path` meta.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

/**
 * Class Transcription
 */
class Transcription extends Base {

	/**
	 * REST route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'transcription';

	/**
	 * Meta key holding the last known SaaS transcription status, used so the
	 * editor can poll between "Transcribing" and "Transcribed".
	 *
	 * @var string
	 */
	const STATUS_META = 'rtgodam_transcript_status';

	/**
	 * Meta flag set when the user deletes the transcript. While set, the GET
	 * endpoint will NOT auto-resurrect the transcript from the SaaS (otherwise
	 * `godam_get_transcript_path()` re-caches it and the delete is undone). It
	 * is cleared on generate / upload so a fresh transcript can replace it.
	 *
	 * @var string
	 */
	const DELETED_META = 'rtgodam_transcript_deleted';

	/**
	 * Meta flag set to `upload` when `rtgodam_transcript_path` is a caption file
	 * the user uploaded in WordPress, rather than a cached copy of GoDAM
	 * Central's default caption. An uploaded file never reaches Central, so the
	 * player plays it ahead of Central's tracks and Central updates never
	 * overwrite it. Cleared on generate and on delete.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	const SOURCE_META = 'rtgodam_transcript_source';

	/**
	 * Register custom REST API.
	 *
	 * @return array Array of registered REST API routes.
	 */
	public function get_rest_routes() {
		$attachment_arg = array(
			'attachment_id' => array(
				'required'          => true,
				'type'              => 'integer',
				'description'       => __( 'The video attachment ID.', 'godam' ),
				'sanitize_callback' => 'absint',
			),
		);

		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base,
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_transcription' ),
						'permission_callback' => array( $this, 'edit_permission' ),
						'args'                => $attachment_arg,
					),
					array(
						'methods'             => \WP_REST_Server::DELETABLE,
						'callback'            => array( $this, 'delete_transcription' ),
						'permission_callback' => array( $this, 'edit_permission' ),
						'args'                => $attachment_arg,
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/generate',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'generate_transcription' ),
					'permission_callback' => array( $this, 'edit_permission' ),
					'args'                => array_merge(
						$attachment_arg,
						array(
							'language'    => array(
								'required'          => false,
								'type'              => 'string',
								'description'       => __( 'BCP 47 language code to transcribe in, or "auto"/"multi" for Deepgram detection. Omitted falls back to the org/default language.', 'godam' ),
								'sanitize_callback' => array( $this, 'sanitize_language' ),
							),
							'track_index' => array(
								'required'          => false,
								'type'              => 'integer',
								'description'       => __( 'Audio stream to transcribe on a multi-audio asset. Omitted transcribes the default track.', 'godam' ),
								'sanitize_callback' => 'absint',
							),
						)
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/upload',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'upload_transcription' ),
					'permission_callback' => array( $this, 'edit_permission' ),
					'args'                => array_merge(
						$attachment_arg,
						array(
							'url' => array(
								'required'          => true,
								'type'              => 'string',
								'description'       => __( 'URL of the uploaded .vtt / .srt caption file.', 'godam' ),
								'sanitize_callback' => 'esc_url_raw',
							),
						)
					),
				),
			),
			// Caption-track management (first-class caption tracks on the SaaS
			// `api/captions.py`). These sit alongside the legacy single-transcript
			// routes above; the editor's caption manager drives them.
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/captions',
				'args'      => array(
					// List every caption track (generated + uploaded) for the asset.
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'list_captions' ),
						'permission_callback' => array( $this, 'edit_permission' ),
						'args'                => $attachment_arg,
					),
					// Upload a new caption track from file text.
					array(
						'methods'             => \WP_REST_Server::CREATABLE,
						'callback'            => array( $this, 'upload_caption' ),
						'permission_callback' => array( $this, 'edit_permission' ),
						'args'                => array_merge( $attachment_arg, $this->caption_write_args( true ) ),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/captions/update',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'update_caption' ),
					'permission_callback' => array( $this, 'edit_permission' ),
					'args'                => array_merge( $attachment_arg, $this->caption_id_arg(), $this->caption_write_args( false ) ),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/captions/delete',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'delete_caption' ),
					'permission_callback' => array( $this, 'edit_permission' ),
					'args'                => array_merge( $attachment_arg, $this->caption_id_arg() ),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/captions/default',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'set_default_caption' ),
					'permission_callback' => array( $this, 'edit_permission' ),
					'args'                => array_merge( $attachment_arg, $this->caption_id_arg() ),
				),
			),
		);
	}

	/**
	 * Shared REST arg schema for a caption track's writable fields.
	 *
	 * @param bool $is_upload Whether this is the create path (makes `content`
	 *                        and `language` required, and adds `source_format`).
	 * @return array REST args schema.
	 */
	private function caption_write_args( $is_upload ) {
		$args = array(
			'language'   => array(
				'required'          => $is_upload,
				'type'              => 'string',
				'description'       => __( 'BCP 47 language tag for the caption track.', 'godam' ),
				'sanitize_callback' => array( $this, 'sanitize_language' ),
			),
			'label'      => array(
				'required'          => false,
				'type'              => 'string',
				'description'       => __( 'Label shown in the subtitle menu.', 'godam' ),
				'sanitize_callback' => 'sanitize_text_field',
			),
			'kind'       => array(
				'required'          => false,
				'type'              => 'string',
				'enum'              => array( 'subtitles', 'captions' ),
				'description'       => __( 'Track kind: subtitles or captions.', 'godam' ),
				'sanitize_callback' => 'sanitize_text_field',
			),
			'is_default' => array(
				'required'          => false,
				'type'              => 'boolean',
				'description'       => __( 'Make this the default caption track.', 'godam' ),
				'sanitize_callback' => 'rest_sanitize_boolean',
			),
			// Caption file text. Deliberately NOT sanitized here: the SaaS
			// validation layer is the trust boundary (it rejects script/event
			// markup, bad timestamps, etc.) and WP sanitizers would corrupt
			// legitimate VTT cue markup. The route is gated to editors.
			'content'    => array(
				'required'    => $is_upload,
				'type'        => 'string',
				'description' => __( 'Caption file text (VTT or SRT).', 'godam' ),
			),
		);

		if ( $is_upload ) {
			$args['source_format'] = array(
				'required'          => false,
				'type'              => 'string',
				'enum'              => array( 'vtt', 'srt' ),
				'description'       => __( 'Format of the uploaded caption text.', 'godam' ),
				'sanitize_callback' => 'sanitize_text_field',
			);
		}

		return $args;
	}

	/**
	 * REST arg schema for the `caption_id` handle.
	 *
	 * @return array REST args schema.
	 */
	private function caption_id_arg() {
		return array(
			'caption_id' => array(
				'required'          => true,
				'type'              => 'string',
				'description'       => __( 'Caption track handle returned by the list endpoint.', 'godam' ),
				'sanitize_callback' => 'sanitize_text_field',
			),
		);
	}

	/**
	 * Sanitize a language code: a BCP 47 tag (e.g. `en`, `pt-BR`, `zh-Hant-TW`)
	 * or the Deepgram detection keywords `auto` / `multi`. Matches the check
	 * Central applies to caption languages (`validate_language`) and keeps the
	 * tag's case, since Central stores it as given. Returns an empty string for
	 * anything else, so the SaaS default language kicks in.
	 *
	 * @param string $value Raw language value.
	 * @return string Sanitized language code, or '' to defer to the SaaS default.
	 */
	public function sanitize_language( $value ) {
		$value = trim( (string) $value );
		if ( '' === $value ) {
			return '';
		}
		// Deepgram detection keywords are passed through in lower case.
		if ( in_array( strtolower( $value ), array( 'auto', 'multi' ), true ) ) {
			return strtolower( $value );
		}
		if ( strlen( $value ) <= 35 && preg_match( '/^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/', $value ) ) {
			return $value;
		}
		return '';
	}

	/**
	 * Permission: the caller must be able to edit the target attachment.
	 *
	 * @param \WP_REST_Request $request REST request object.
	 * @return bool Whether the request is allowed.
	 */
	public function edit_permission( \WP_REST_Request $request ) {
		$attachment_id = absint( $request->get_param( 'attachment_id' ) );
		if ( empty( $attachment_id ) ) {
			return current_user_can( 'upload_files' );
		}

		/**
		 * Fires before this attachment-specific capability check, so
		 * integrations that centralize media on another site can switch
		 * context first.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		$can_edit = current_user_can( 'edit_post', $attachment_id );
		do_action( 'rtgodam_after_attachment_lookup' );

		return $can_edit;
	}

	/**
	 * Return the current transcript path + status for an attachment.
	 *
	 * @param \WP_REST_Request $request REST request object.
	 * @return \WP_REST_Response
	 */
	public function get_transcription( \WP_REST_Request $request ) {
		$attachment_id = absint( $request->get_param( 'attachment_id' ) );

		/**
		 * Fires before reading this attachment's transcript meta, so
		 * integrations that centralize media on another site can switch
		 * context first.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );

		// Locally-stored transcript takes precedence.
		$path = get_post_meta( $attachment_id, 'rtgodam_transcript_path', true );

		// Auto-discover from the SaaS only when the user has NOT deleted the
		// transcript. Otherwise `godam_get_transcript_path()` would re-cache it
		// and silently undo the delete.
		if ( empty( $path ) && ! get_post_meta( $attachment_id, self::DELETED_META, true ) ) {
			$path = godam_get_transcript_path( $attachment_id );
		}

		$status = $path ? 'Transcribed' : (string) get_post_meta( $attachment_id, self::STATUS_META, true );

		do_action( 'rtgodam_after_attachment_lookup' );

		return rest_ensure_response( $this->shape( $path, $status ) );
	}

	/**
	 * Start (or re-run) AI transcription via the SaaS `process_transcription`
	 * endpoint.
	 *
	 * @param \WP_REST_Request $request REST request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function generate_transcription( \WP_REST_Request $request ) {
		$attachment_id = absint( $request->get_param( 'attachment_id' ) );

		/**
		 * Fires before reading this attachment's job-ID meta, so integrations
		 * that centralize media on another site can switch context first.
		 * Closed immediately after (not held open across the SaaS HTTP call
		 * below) — see the second, separate pair around the meta writes
		 * further down.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		$job_id = get_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', true );
		if ( empty( $job_id ) ) {
			$job_id = get_post_meta( $attachment_id, '_godam_original_id', true );
		}
		do_action( 'rtgodam_after_attachment_lookup' );

		if ( empty( $job_id ) ) {
			return new \WP_Error(
				'rtgodam_no_job',
				__( 'This video has not been transcoded yet, so it cannot be transcribed.', 'godam' ),
				array( 'status' => 400 )
			);
		}

		$api_key = get_option( 'rtgodam-api-key', '' );
		if ( empty( $api_key ) ) {
			return new \WP_Error(
				'rtgodam_no_api_key',
				__( 'Connect your GoDAM account to generate transcriptions.', 'godam' ),
				array( 'status' => 400 )
			);
		}

		$body = array(
			'job_name' => sanitize_text_field( $job_id ),
			'api_key'  => sanitize_text_field( $api_key ),
		);

		// Multilingual / multi-audio transcription (feat/multilingual-multiaudio-
		// transcription on the SaaS). Both are optional: omit `language` to defer
		// to the org/default language, omit `track_index` to transcribe the
		// default audio track. Empty string from `sanitize_language` means "defer".
		$language = $request->get_param( 'language' );
		if ( ! empty( $language ) ) {
			$body['language'] = $language;
		}
		if ( null !== $request->get_param( 'track_index' ) ) {
			$body['track_index'] = absint( $request->get_param( 'track_index' ) );
		}

		$response = wp_remote_post(
			RTGODAM_API_BASE . '/api/method/godam_core.api.process.process_transcription',
			array(
				'timeout' => 15, // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout
				'body'    => $body,
			)
		);

		if ( is_wp_error( $response ) ) {
			return new \WP_Error(
				'rtgodam_request_failed',
				__( 'Could not reach the transcription service. Please try again.', 'godam' ),
				array( 'status' => 502 )
			);
		}

		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		// Frappe wraps `@frappe.whitelist` method results in a `message` key.
		$payload = ( is_array( $data ) && isset( $data['message'] ) ) ? $data['message'] : $data;
		$payload = is_array( $payload ) ? $payload : array();

		$path           = isset( $payload['transcript_path'] ) ? esc_url_raw( $payload['transcript_path'] ) : '';
		$status         = isset( $payload['status'] ) ? sanitize_text_field( $payload['status'] ) : '';
		$current_status = isset( $payload['current_status'] ) ? sanitize_text_field( $payload['current_status'] ) : '';

		/**
		 * Fires before writing this attachment's transcript/status meta, so
		 * integrations that centralize media on another site can switch
		 * context first — a second, separate pair from the one above, so
		 * the switch isn't held open across the SaaS HTTP call in between.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		if ( ! empty( $path ) ) {
			// A (re)generated transcript supersedes any prior delete or upload.
			delete_post_meta( $attachment_id, self::DELETED_META );
			delete_post_meta( $attachment_id, self::SOURCE_META );
			update_post_meta( $attachment_id, 'rtgodam_transcript_path', $path );
			update_post_meta( $attachment_id, self::STATUS_META, 'Transcribed' );
		} elseif ( '' !== $current_status || '' !== $status ) {
			// A job is genuinely in progress — clear the delete marker and
			// remember the in-flight status so the editor keeps polling. On a
			// hard error we leave the delete marker intact.
			delete_post_meta( $attachment_id, self::DELETED_META );
			delete_post_meta( $attachment_id, self::SOURCE_META );
			$track = $current_status ? $current_status : $status;
			update_post_meta( $attachment_id, self::STATUS_META, $track );
		}
		do_action( 'rtgodam_after_attachment_lookup' );

		return rest_ensure_response(
			array(
				'success'         => ! empty( $payload['success'] ),
				'status'          => $status,
				'current_status'  => $current_status,
				'transcript_path' => $path,
				'error'           => isset( $payload['error'] ) ? sanitize_text_field( $payload['error'] ) : '',
				'message'         => isset( $payload['message'] ) ? sanitize_text_field( $payload['message'] ) : '',
			)
		);
	}

	/**
	 * Attach an uploaded caption file as the transcript.
	 *
	 * @param \WP_REST_Request $request REST request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function upload_transcription( \WP_REST_Request $request ) {
		$attachment_id = absint( $request->get_param( 'attachment_id' ) );
		$url           = esc_url_raw( $request->get_param( 'url' ) );

		$ext = strtolower( pathinfo( wp_parse_url( $url, PHP_URL_PATH ), PATHINFO_EXTENSION ) );
		if ( ! in_array( $ext, array( 'vtt', 'srt' ), true ) ) {
			return new \WP_Error(
				'rtgodam_bad_file',
				__( 'Only .vtt or .srt caption files are supported.', 'godam' ),
				array( 'status' => 400 )
			);
		}

		/**
		 * Fires before writing this attachment's transcript meta, so
		 * integrations that centralize media on another site can switch
		 * context first.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		// An uploaded transcript supersedes any prior delete.
		delete_post_meta( $attachment_id, self::DELETED_META );
		update_post_meta( $attachment_id, 'rtgodam_transcript_path', $url );
		update_post_meta( $attachment_id, self::SOURCE_META, 'upload' );
		update_post_meta( $attachment_id, self::STATUS_META, 'Transcribed' );
		do_action( 'rtgodam_after_attachment_lookup' );

		return rest_ensure_response( $this->shape( $url, 'Transcribed' ) );
	}

	/**
	 * Remove the transcript from an attachment.
	 *
	 * @param \WP_REST_Request $request REST request object.
	 * @return \WP_REST_Response
	 */
	public function delete_transcription( \WP_REST_Request $request ) {
		$attachment_id = absint( $request->get_param( 'attachment_id' ) );

		/**
		 * Fires before deleting/writing this attachment's transcript meta,
		 * so integrations that centralize media on another site can switch
		 * context first.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		delete_post_meta( $attachment_id, 'rtgodam_transcript_path' );
		delete_post_meta( $attachment_id, self::STATUS_META );
		delete_post_meta( $attachment_id, self::SOURCE_META );
		// Mark as deleted so GET won't auto-resurrect it from the SaaS.
		update_post_meta( $attachment_id, self::DELETED_META, '1' );
		do_action( 'rtgodam_after_attachment_lookup' );

		return rest_ensure_response( $this->shape( '', '' ) );
	}

	/*
	 * Caption-track management (SaaS `api/captions.py`).
	 *
	 * Thin proxies that resolve the attachment's transcoding job-ID and inject
	 * the server-side licence key, so the editor never sees the key. The SaaS
	 * owns validation (file size, UTF-8, timestamps, markup, language, limits)
	 * and returns one reason at a time; we surface it verbatim.
	 */

	/**
	 * List every caption track (generated + uploaded) for an attachment.
	 *
	 * @param \WP_REST_Request $request REST request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function list_captions( \WP_REST_Request $request ) {
		$context = $this->caption_context( absint( $request->get_param( 'attachment_id' ) ) );
		if ( is_wp_error( $context ) ) {
			return $context;
		}

		return $this->call_saas(
			'godam_core.api.captions.list_captions',
			array(
				'job_name' => $context['job_id'],
				'api_key'  => $context['api_key'],
			)
		);
	}

	/**
	 * Upload a new caption track from file text.
	 *
	 * @param \WP_REST_Request $request REST request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function upload_caption( \WP_REST_Request $request ) {
		$context = $this->caption_context( absint( $request->get_param( 'attachment_id' ) ) );
		if ( is_wp_error( $context ) ) {
			return $context;
		}

		return $this->write_caption(
			absint( $request->get_param( 'attachment_id' ) ),
			'godam_core.api.captions.upload_caption',
			array(
				'job_name'      => $context['job_id'],
				'api_key'       => $context['api_key'],
				'content'       => (string) $request->get_param( 'content' ),
				'language'      => (string) $request->get_param( 'language' ),
				'label'         => (string) $request->get_param( 'label' ),
				'kind'          => $request->get_param( 'kind' ) ? $request->get_param( 'kind' ) : 'subtitles',
				'is_default'    => $request->get_param( 'is_default' ) ? 1 : 0,
				'source_format' => $request->get_param( 'source_format' ) ? $request->get_param( 'source_format' ) : 'vtt',
			)
		);
	}

	/**
	 * Replace or edit an existing caption track.
	 *
	 * @param \WP_REST_Request $request REST request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function update_caption( \WP_REST_Request $request ) {
		$context = $this->caption_context( absint( $request->get_param( 'attachment_id' ) ) );
		if ( is_wp_error( $context ) ) {
			return $context;
		}

		// Only forward fields the caller actually supplied, so an edit of (say)
		// the label alone does not blank the language or re-send the whole file.
		$body = array(
			'job_name'   => $context['job_id'],
			'api_key'    => $context['api_key'],
			'caption_id' => $request->get_param( 'caption_id' ),
		);
		foreach ( array( 'content', 'language', 'label', 'kind' ) as $field ) {
			$value = $request->get_param( $field );
			if ( null !== $value ) {
				$body[ $field ] = $value;
			}
		}
		if ( null !== $request->get_param( 'is_default' ) ) {
			$body['is_default'] = $request->get_param( 'is_default' ) ? 1 : 0;
		}

		return $this->write_caption( absint( $request->get_param( 'attachment_id' ) ), 'godam_core.api.captions.update_caption', $body );
	}

	/**
	 * Delete a caption track. Deleting a generated track resets the linked audio
	 * track to Pending on the SaaS, so its Transcribe action returns.
	 *
	 * @param \WP_REST_Request $request REST request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function delete_caption( \WP_REST_Request $request ) {
		$context = $this->caption_context( absint( $request->get_param( 'attachment_id' ) ) );
		if ( is_wp_error( $context ) ) {
			return $context;
		}

		return $this->write_caption(
			absint( $request->get_param( 'attachment_id' ) ),
			'godam_core.api.captions.delete_caption',
			array(
				'job_name'   => $context['job_id'],
				'api_key'    => $context['api_key'],
				'caption_id' => $request->get_param( 'caption_id' ),
			)
		);
	}

	/**
	 * Mark a caption track as the default for playback.
	 *
	 * @param \WP_REST_Request $request REST request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function set_default_caption( \WP_REST_Request $request ) {
		$context = $this->caption_context( absint( $request->get_param( 'attachment_id' ) ) );
		if ( is_wp_error( $context ) ) {
			return $context;
		}

		return $this->write_caption(
			absint( $request->get_param( 'attachment_id' ) ),
			'godam_core.api.captions.set_default_caption',
			array(
				'job_name'   => $context['job_id'],
				'api_key'    => $context['api_key'],
				'caption_id' => $request->get_param( 'caption_id' ),
			)
		);
	}

	/**
	 * Send a caption write to the SaaS and, on success, bring the attachment's
	 * cached transcript in line with the caption list the SaaS returns.
	 *
	 * @param int    $attachment_id WordPress attachment ID.
	 * @param string $method        Dotted Frappe method path.
	 * @param array  $body          Request body.
	 * @return \WP_REST_Response|\WP_Error
	 */
	private function write_caption( $attachment_id, $method, $body ) {
		$response = $this->call_saas( $method, $body );
		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$data = $response->get_data();
		if ( isset( $data['captions'] ) && is_array( $data['captions'] ) ) {
			self::sync_cached_transcript( $attachment_id, $data['captions'] );
		}

		return $response;
	}

	/**
	 * Point the attachment's cached transcript (`rtgodam_transcript_path`) at
	 * the default caption track Central reports, so the editor's Transcription
	 * tab, the video SEO data and the player's fallback follow caption changes.
	 *
	 * A transcript the user uploaded in WordPress is left alone: it never
	 * reaches Central, so Central's list says nothing about it. The delete
	 * marker is cleared, because Central's tracks are now what the user manages.
	 *
	 * @since n.e.x.t
	 *
	 * @param int   $attachment_id  WordPress attachment ID.
	 * @param array $captions       Caption-track rows from the SaaS.
	 * @param bool  $switch_context Whether to fire the attachment-lookup actions
	 *                              around the meta writes. Pass false when the
	 *                              caller already fired them.
	 * @return void
	 */
	public static function sync_cached_transcript( $attachment_id, $captions, $switch_context = true ) {
		$default_path = '';
		foreach ( $captions as $caption ) {
			if ( is_array( $caption ) && ! empty( $caption['is_default'] ) && ! empty( $caption['vtt_path'] ) ) {
				$default_path = esc_url_raw( $caption['vtt_path'] );
				break;
			}
		}

		if ( $switch_context ) {
			/** This action is documented in inc/classes/rest-api/class-transcription.php */
			do_action( 'rtgodam_before_attachment_lookup' );
		}
		delete_post_meta( $attachment_id, self::DELETED_META );
		if ( 'upload' !== get_post_meta( $attachment_id, self::SOURCE_META, true ) ) {
			if ( '' !== $default_path ) {
				update_post_meta( $attachment_id, 'rtgodam_transcript_path', $default_path );
				update_post_meta( $attachment_id, self::STATUS_META, 'Transcribed' );
			} else {
				delete_post_meta( $attachment_id, 'rtgodam_transcript_path' );
				delete_post_meta( $attachment_id, self::STATUS_META );
			}
		}
		if ( $switch_context ) {
			do_action( 'rtgodam_after_attachment_lookup' );
		}
	}

	/**
	 * Resolve the transcoding job-ID and licence key an attachment needs to talk
	 * to the SaaS caption endpoints.
	 *
	 * @param int $attachment_id WordPress attachment ID.
	 * @return array{job_id:string,api_key:string}|\WP_Error
	 */
	private function caption_context( $attachment_id ) {
		/**
		 * Fires before reading this attachment's job-ID meta, so integrations
		 * that centralize media on another site can switch context first.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		$job_id = get_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', true );
		if ( empty( $job_id ) ) {
			$job_id = get_post_meta( $attachment_id, '_godam_original_id', true );
		}
		do_action( 'rtgodam_after_attachment_lookup' );

		if ( empty( $job_id ) ) {
			return new \WP_Error(
				'rtgodam_no_job',
				__( 'This video has not been transcoded yet, so it has no captions.', 'godam' ),
				array( 'status' => 400 )
			);
		}

		$api_key = get_option( 'rtgodam-api-key', '' );
		if ( empty( $api_key ) ) {
			return new \WP_Error(
				'rtgodam_no_api_key',
				__( 'Connect your GoDAM account to manage captions.', 'godam' ),
				array( 'status' => 400 )
			);
		}

		return array(
			'job_id'  => sanitize_text_field( $job_id ),
			'api_key' => sanitize_text_field( $api_key ),
		);
	}

	/**
	 * POST to a SaaS whitelisted method and unwrap Frappe's `message` envelope.
	 * A SaaS-reported error (validation reason, access denied) is surfaced as a
	 * WP_Error so the editor shows the exact message.
	 *
	 * @param string $method Dotted Frappe method path.
	 * @param array  $body   Request body.
	 * @return \WP_REST_Response|\WP_Error
	 */
	private function call_saas( $method, $body ) {
		$response = wp_remote_post(
			RTGODAM_API_BASE . '/api/method/' . $method,
			array(
				'timeout' => 20, // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout
				'body'    => $body,
			)
		);

		if ( is_wp_error( $response ) ) {
			return new \WP_Error(
				'rtgodam_request_failed',
				__( 'Could not reach the caption service. Please try again.', 'godam' ),
				array( 'status' => 502 )
			);
		}

		$code    = (int) wp_remote_retrieve_response_code( $response );
		$data    = json_decode( wp_remote_retrieve_body( $response ), true );
		$payload = ( is_array( $data ) && isset( $data['message'] ) ) ? $data['message'] : $data;

		// Surface a SaaS-side failure (e.g. a validation reason) as an error the
		// editor can show. The caption API returns one reason at a time.
		if ( $code >= 400 || ( is_array( $payload ) && isset( $payload['success'] ) && false === $payload['success'] ) ) {
			$message = '';
			if ( is_array( $payload ) ) {
				$message = isset( $payload['error'] ) ? $payload['error'] : ( $payload['message'] ?? '' );
			}
			return new \WP_Error(
				'rtgodam_caption_error',
				$message ? sanitize_text_field( $message ) : __( 'The caption service rejected the request.', 'godam' ),
				array( 'status' => $code >= 400 ? $code : 400 )
			);
		}

		return rest_ensure_response( is_array( $payload ) ? $payload : array() );
	}

	/**
	 * Build the response shape the editor consumes.
	 *
	 * @param string $path   Transcript URL (may be empty).
	 * @param string $status Transcription status.
	 * @return array Response body.
	 */
	private function shape( $path, $status ) {
		return array(
			'transcript_path' => $path,
			'status'          => $status,
			'file_name'       => $path ? basename( wp_parse_url( $path, PHP_URL_PATH ) ) : '',
		);
	}
}
