<?php
/**
 * Abilities that send media to GoDAM for processing.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Abilities;

defined( 'ABSPATH' ) || exit;

/**
 * Class Processing_Abilities
 *
 * Both abilities start asynchronous work on GoDAM's servers and return as soon
 * as the job is accepted. Results arrive later through GoDAM's callback to
 * this site, so an agent should check godam/get-media afterwards rather than
 * expect a finished result.
 *
 * @since n.e.x.t
 */
class Processing_Abilities extends Ability_Group {

	/**
	 * Registers this group's abilities.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function register() {
		$this->add(
			'godam/request-transcription',
			array(
				'label'               => __( 'Request transcription', 'godam' ),
				'description'         => __( 'Ask GoDAM to transcribe a video or audio item. Runs in the background; read the result later with godam/get-transcript. Uses transcription minutes from the GoDAM plan.', 'godam' ),
				'category'            => 'godam-processing',
				'input_schema'        => $this->media_id_input(),
				'output_schema'       => array( 'type' => 'object' ),
				'execute_callback'    => array( $this, 'request_transcription' ),
				'permission_callback' => array( $this, 'can_edit_media' ),
			),
			true
		);

		$this->add(
			'godam/retranscode-media',
			array(
				'label'               => __( 'Retranscode media', 'godam' ),
				'description'         => __( 'Send a media item to GoDAM to be transcoded again, for example after a failed transcode. Runs in the background; check progress with godam/get-media.', 'godam' ),
				'category'            => 'godam-processing',
				'input_schema'        => $this->media_id_input(),
				'output_schema'       => array( 'type' => 'object' ),
				'execute_callback'    => array( $this, 'retranscode_media' ),
				'permission_callback' => array( $this, 'can_edit_media' ),
			),
			true
		);
	}

	/**
	 * Executes godam/request-transcription.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Ability input.
	 *
	 * @return array|\WP_Error
	 */
	public function request_transcription( $input = array() ) {
		$post = $this->get_attachment( $input['id'] ?? 0 );

		if ( is_wp_error( $post ) ) {
			return $post;
		}

		$type = $this->media_type( $this->attachment_mime_type( $post ) );

		if ( ! in_array( $type, array( 'video', 'audio' ), true ) ) {
			return new \WP_Error(
				'rtgodam_not_transcribable',
				/* translators: %s: media type, e.g. image. */
				sprintf( __( 'Only video and audio can be transcribed; this item is %s. Use godam/list-media to find a video or audio item.', 'godam' ), $type )
			);
		}

		$result = $this->rest( 'POST', '/godam/v1/transcription/generate', array( 'attachment_id' => $post->ID ) );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return array(
			'media_id' => $post->ID,
			'accepted' => true,
			'response' => $result,
			'next'     => __( 'Transcription runs in the background. Call godam/get-transcript later to read it.', 'godam' ),
		);
	}

	/**
	 * Executes godam/retranscode-media.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Ability input.
	 *
	 * @return array|\WP_Error
	 */
	public function retranscode_media( $input = array() ) {
		$post = $this->get_attachment( $input['id'] ?? 0 );

		if ( is_wp_error( $post ) ) {
			return $post;
		}

		$result = $this->rest( 'POST', '/godam/v1/transcoding/retranscode', array( 'id' => $post->ID ) );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		/*
		 * The route answers 200 with `skipped: true` when it does not send the job (virtual
		 * media, storage over the limit, HTTP auth, a Central refusal). That is not an
		 * accepted job, so report it as an error. The route's own message already names the
		 * next step; it is built with esc_html(), so hand the agent plain text.
		 */
		if ( is_array( $result ) && ! empty( $result['skipped'] ) ) {
			$reason = isset( $result['reason'] ) ? sanitize_key( (string) $result['reason'] ) : '';

			return new \WP_Error(
				'' !== $reason ? $reason : 'rtgodam_retranscode_skipped',
				html_entity_decode( wp_strip_all_tags( (string) ( $result['message'] ?? '' ) ), ENT_QUOTES, 'UTF-8' ),
				array( 'status' => 409 )
			);
		}

		return array(
			'media_id' => $post->ID,
			'accepted' => true,
			'response' => $result,
			'next'     => __( 'Transcoding runs in the background. Call godam/get-media later to see its status.', 'godam' ),
		);
	}
}
