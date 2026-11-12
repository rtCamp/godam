<?php
/**
 * Abilities for the chapters on a GoDAM video or audio item.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Abilities;

defined( 'ABSPATH' ) || exit;

/**
 * Class Chapter_Abilities
 *
 * Chapters live in the attachment's `rtgodam_meta['chapters']`, the list the
 * media editor's Chapters tab saves, and are written in the same shape: times
 * as strings of seconds, plus the editor's clock-style copies of them. The
 * editor's own rules apply: every chapter has a title, ends after it starts,
 * stays within the media's length, and does not overlap another chapter.
 *
 * @since n.e.x.t
 */
class Chapter_Abilities extends Ability_Group {

	/**
	 * Registers this group's abilities.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function register() {
		$this->add(
			'godam/list-chapters',
			array(
				'label'               => __( 'List chapters', 'godam' ),
				'description'         => __( 'List the chapters of a video or audio item in playback order, with start and end in seconds.', 'godam' ),
				'category'            => 'godam-player',
				'input_schema'        => $this->media_id_input(),
				'output_schema'       => array(
					'type'       => 'object',
					'properties' => array(
						'media_id' => array( 'type' => 'integer' ),
						'count'    => array( 'type' => 'integer' ),
						'chapters' => array(
							'type'  => 'array',
							'items' => $this->chapter_schema(),
						),
					),
				),
				'execute_callback'    => array( $this, 'list_chapters' ),
				'permission_callback' => array( $this, 'can_edit_media' ),
			)
		);

		$this->add(
			'godam/set-chapters',
			array(
				'label'               => __( 'Set chapters', 'godam' ),
				'description'         => __( 'Replace all chapters of a video or audio item. Each chapter needs a title and a start second; end defaults to where the next chapter starts, and the last chapter runs to the end. Chapters may not overlap or run past the end of the media. To make chapters from speech, read godam/get-transcript with format "segments" first. An empty list removes every chapter.', 'godam' ),
				'category'            => 'godam-player',
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array(
						'id'       => array(
							'type'        => 'integer',
							'minimum'     => 1,
							'description' => __( 'Media (attachment) ID of the video or audio item.', 'godam' ),
						),
						'chapters' => array(
							'type'  => 'array',
							'items' => array(
								'type'       => 'object',
								'properties' => array(
									'title' => array(
										'type'      => 'string',
										'minLength' => 1,
									),
									'start' => array(
										'type'        => 'number',
										'minimum'     => 0,
										'description' => __( 'Second at which the chapter starts.', 'godam' ),
									),
									'end'   => array(
										'type'        => 'number',
										'minimum'     => 0,
										'description' => __( 'Second at which the chapter ends. Optional.', 'godam' ),
									),
								),
								'required'   => array( 'title', 'start' ),
							),
						),
					),
					'required'   => array( 'id', 'chapters' ),
				),
				'output_schema'       => array(
					'type'       => 'object',
					'properties' => array(
						'media_id'   => array( 'type' => 'integer' ),
						'count'      => array( 'type' => 'integer' ),
						'chapters'   => array(
							'type'  => 'array',
							'items' => $this->chapter_schema(),
						),
						'editor_url' => array( 'type' => 'string' ),
					),
				),
				'execute_callback'    => array( $this, 'set_chapters' ),
				'permission_callback' => array( $this, 'can_edit_media' ),
				'meta'                => array(
					'annotations' => array(
						'destructive' => true,
						'idempotent'  => true,
					),
				),
			),
			true
		);
	}

	/**
	 * JSON Schema for a chapter as these abilities return it.
	 *
	 * @since n.e.x.t
	 *
	 * @return array
	 */
	private function chapter_schema() {
		return array(
			'type'       => 'object',
			'properties' => array(
				'id'    => array( 'type' => 'string' ),
				'title' => array( 'type' => 'string' ),
				'start' => array( 'type' => 'number' ),
				'end'   => array(
					'type'        => array( 'number', 'null' ),
					'description' => 'Null when the chapter runs to the end of the media.',
				),
			),
		);
	}

	/**
	 * Executes godam/list-chapters.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Ability input.
	 *
	 * @return array|\WP_Error
	 */
	public function list_chapters( $input = array() ) {
		$post = $this->get_timed_media( $input['id'] ?? 0 );

		if ( is_wp_error( $post ) ) {
			return $post;
		}

		$meta     = $this->godam_meta( $post->ID );
		$stored   = ( isset( $meta['chapters'] ) && is_array( $meta['chapters'] ) ) ? $meta['chapters'] : array();
		$chapters = array_map( array( $this, 'describe_chapter' ), $stored );

		usort(
			$chapters,
			static function ( $a, $b ) {
				return $a['start'] <=> $b['start'];
			}
		);

		return array(
			'media_id' => $post->ID,
			'count'    => count( $chapters ),
			'chapters' => $chapters,
		);
	}

	/**
	 * Executes godam/set-chapters.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Ability input.
	 *
	 * @return array|\WP_Error
	 */
	public function set_chapters( $input = array() ) {
		$post = $this->get_timed_media( $input['id'] ?? 0 );

		if ( is_wp_error( $post ) ) {
			return $post;
		}

		$ranges = $this->resolve_ranges( (array) ( $input['chapters'] ?? array() ), $this->duration( $post->ID )['seconds'] );

		if ( is_wp_error( $ranges ) ) {
			return $ranges;
		}

		$chapters = array();

		foreach ( $ranges as $range ) {
			$chapters[] = array(
				'id'              => wp_generate_uuid4(),
				'text'            => $range['title'],
				'startTime'       => $this->seconds_string( $range['start'] ),
				'originalTime'    => $this->clock( $range['start'] ),
				'endTime'         => null === $range['end'] ? '' : $this->seconds_string( $range['end'] ),
				'originalEndTime' => null === $range['end'] ? '' : $this->clock( $range['end'] ),
			);
		}

		$meta             = $this->godam_meta( $post->ID );
		$meta['chapters'] = $chapters;

		$saved = $this->save_godam_meta( $post->ID, $meta );

		if ( is_wp_error( $saved ) ) {
			return $saved;
		}

		return array(
			'media_id'   => $post->ID,
			'count'      => count( $chapters ),
			'chapters'   => array_map( array( $this, 'describe_chapter' ), $chapters ),
			'editor_url' => $this->editor_url( $post->ID ),
		);
	}

	/**
	 * Sorts the requested chapters, fills in missing ends and checks them the
	 * way the media editor's chapter form does.
	 *
	 * A missing end becomes the next chapter's start. The last chapter's
	 * missing end stays empty, which the editor reads as "to the end of the
	 * media"; the player ends the last chapter there in any case.
	 *
	 * @since n.e.x.t
	 *
	 * @param array    $requested Chapters from the ability input.
	 * @param int|null $duration  Media length in seconds, if WordPress knows it.
	 *
	 * @return array[]|\WP_Error Ranges of `{title, start, end}`, end null when open.
	 */
	private function resolve_ranges( array $requested, $duration ) {
		$ranges = array();

		foreach ( array_values( $requested ) as $index => $chapter ) {
			$title = trim( sanitize_text_field( $chapter['title'] ?? '' ) );

			if ( '' === $title ) {
				/* translators: %d: chapter number, counting from 1. */
				return $this->invalid( sprintf( __( 'Chapter %d needs a title.', 'godam' ), $index + 1 ) );
			}

			$ranges[] = array(
				'title' => $title,
				'start' => round( (float) ( $chapter['start'] ?? 0 ), 3 ),
				'end'   => isset( $chapter['end'] ) ? round( (float) $chapter['end'], 3 ) : null,
			);
		}

		usort(
			$ranges,
			static function ( $a, $b ) {
				return $a['start'] <=> $b['start'];
			}
		);

		$count = count( $ranges );

		for ( $i = 0; $i < $count; $i++ ) {
			if ( null === $ranges[ $i ]['end'] && $i < $count - 1 ) {
				$ranges[ $i ]['end'] = $ranges[ $i + 1 ]['start'];
			}
		}

		$length = ( null !== $duration ) ? sprintf(
			/* translators: %d: media length in seconds. */
			__( 'WordPress reads this file as %d seconds long.', 'godam' ),
			$duration
		) : '';

		foreach ( $ranges as $i => $range ) {
			$end = null === $range['end'] ? null : $range['end'];

			if ( null !== $duration && $range['start'] > $duration ) {
				/* translators: 1: chapter title, 2: sentence giving the media length. */
				return $this->invalid( sprintf( __( '"%1$s" starts after the end of the media. %2$s Use a start time inside the media.', 'godam' ), $range['title'], $length ) );
			}

			if ( null !== $end && $end <= $range['start'] ) {
				/* translators: %s: chapter title. */
				return $this->invalid( sprintf( __( '"%s" must end after it starts. Give an end later than its start, or leave end out.', 'godam' ), $range['title'] ) );
			}

			if ( null !== $duration && null !== $end && $end > $duration ) {
				/* translators: 1: chapter title, 2: sentence giving the media length. */
				return $this->invalid( sprintf( __( '"%1$s" ends after the end of the media. %2$s Use an end time inside the media, or leave end out.', 'godam' ), $range['title'], $length ) );
			}

			// Ranges overlap when each starts before the other ends; an open end runs to the end.
			$next = $ranges[ $i + 1 ] ?? null;

			if ( $next && ( null === $end || $next['start'] < $end ) ) {
				return $this->invalid(
					/* translators: 1: chapter title, 2: the overlapping chapter's title. */
					sprintf( __( '"%1$s" overlaps "%2$s". Each chapter must end at or before the next one starts.', 'godam' ), $range['title'], $next['title'] )
				);
			}
		}

		return $ranges;
	}

	/**
	 * A compact description of a stored chapter.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $chapter Stored chapter.
	 *
	 * @return array
	 */
	private function describe_chapter( $chapter ) {
		$chapter = (array) $chapter;
		$end     = $chapter['endTime'] ?? '';

		return array(
			'id'    => (string) ( $chapter['id'] ?? '' ),
			'title' => (string) ( $chapter['text'] ?? '' ),
			'start' => (float) ( $chapter['startTime'] ?? 0 ),
			'end'   => ( null === $end || '' === $end ) ? null : (float) $end,
		);
	}

	/**
	 * Seconds as the editor stores them: JavaScript's String() of the number.
	 *
	 * @since n.e.x.t
	 *
	 * @param float $seconds Seconds.
	 *
	 * @return string
	 */
	private function seconds_string( $seconds ) {
		return (string) ( floor( $seconds ) === $seconds ? (int) $seconds : $seconds );
	}

	/**
	 * Seconds as the editor's clock-style copy: `mm:ss.ss`, or `hh:mm:ss.ss`
	 * from an hour on.
	 *
	 * @since n.e.x.t
	 *
	 * @param float $seconds Seconds.
	 *
	 * @return string
	 */
	private function clock( $seconds ) {
		$hours   = (int) floor( $seconds / 3600 );
		$minutes = (int) floor( fmod( $seconds, 3600 ) / 60 );
		$rest    = sprintf( '%05.2f', fmod( $seconds, 60 ) );

		return $hours > 0
			? sprintf( '%02d:%02d:%s', $hours, $minutes, $rest )
			: sprintf( '%02d:%s', $minutes, $rest );
	}

	/**
	 * Error for chapters the media editor would not accept.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $message What is wrong.
	 *
	 * @return \WP_Error
	 */
	private function invalid( $message ) {
		return new \WP_Error( 'rtgodam_invalid_chapters', trim( $message ), array( 'status' => 400 ) );
	}

	/**
	 * Returns the attachment if it is a video or audio item.
	 *
	 * @since n.e.x.t
	 *
	 * @param int $attachment_id Attachment ID.
	 *
	 * @return \WP_Post|\WP_Error
	 */
	private function get_timed_media( $attachment_id ) {
		$post = $this->get_attachment( $attachment_id );

		if ( is_wp_error( $post ) ) {
			return $post;
		}

		if ( ! in_array( $this->media_type( $this->attachment_mime_type( $post ) ), array( 'video', 'audio' ), true ) ) {
			return new \WP_Error( 'rtgodam_no_chapters_for_type', __( 'Only videos and audio have chapters. Use godam/list-media to find a video or audio item.', 'godam' ), array( 'status' => 400 ) );
		}

		return $post;
	}
}
