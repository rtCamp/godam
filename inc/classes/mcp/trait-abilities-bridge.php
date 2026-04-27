<?php
/**
 * MCP abilities partial: Abilities_Bridge.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\MCP;

use RTGODAM\Inc\Media_Library\Media_Folder_Utils;
use RTGODAM\Inc\REST_API\Analytics;
use RTGODAM\Inc\REST_API\Media_Library;
use RTGODAM\Inc\REST_API\Site;
use RTGODAM\Inc\REST_API\Transcoding;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

defined( 'ABSPATH' ) || exit;

/**
 * Abilities_Bridge trait.
 */
trait Abilities_Bridge {

	/**
	 * Build the normalized bridge response envelope.
	 *
	 * @param array<string, mixed> $data Source data.
	 * @param string               $summary Human-readable summary.
	 * @param array<string, mixed> $source_status Source status payload.
	 * @param array<int, mixed>    $errors Errors.
	 * @param bool                 $success Whether the bridge call succeeded.
	 * @return array<string, mixed>
	 */
	private function build_bridge_envelope( array $data, $summary, array $source_status = array(), array $errors = array(), $success = true ) {
		return array(
			'success'       => (bool) $success,
			'data'          => $data,
			'summary'       => (string) $summary,
			'source_status' => $source_status,
			'errors'        => $errors,
		);
	}

	/**
	 * Normalize a folder record exactly like the Node MCP server.
	 *
	 * @param array<string, mixed> $folder Folder payload.
	 * @return array<string, mixed>
	 */
	private function normalize_folder_record_exact( array $folder ) {
		$item_count = (int) ( $folder['attachmentCount'] ?? $folder['count'] ?? 0 );
		$status     = 'healthy';

		if ( 0 === $item_count ) {
			$status = 'empty_folder';
		} elseif ( $item_count > 250 ) {
			$status = 'oversized_folder';
		}

		$meta = isset( $folder['meta'] ) && is_array( $folder['meta'] ) ? $folder['meta'] : array();

		return array(
			'folder_id'  => (int) ( $folder['id'] ?? 0 ),
			'name'       => (string) ( $folder['name'] ?? '' ),
			'parent'     => (int) ( $folder['parent'] ?? 0 ),
			'item_count' => $item_count,
			'locked'     => ! empty( $meta['locked'] ),
			'bookmark'   => ! empty( $meta['bookmark'] ),
			'status'     => $status,
		);
	}

	/**
	 * Resolve an entity ID using the same logic as the Node MCP server.
	 *
	 * @param string $entity Entity type.
	 * @param int    $id Exact id.
	 * @param string $name Fuzzy name.
	 * @param int    $limit Search candidate limit.
	 * @return array<string, mixed>|WP_Error
	 */
	private function resolve_entity_id( $entity, $id, $name, $limit = 5 ) {
		if ( $id > 0 ) {
			return array(
				'id'             => (int) $id,
				'matchType'      => 'id',
				'confidence'     => 1,
				'candidateCount' => 1,
			);
		}

		$name = trim( (string) $name );
		if ( '' === $name ) {
			/* translators: %s: Entity type. */
			return new WP_Error( 'godam_mcp_invalid_entity_reference', sprintf( __( 'A valid %s id or name is required.', 'godam' ), $entity ), array( 'status' => 400 ) );
		}

		$candidates = 'folder' === $entity
			? $this->search_folder_candidates( $name )
			: $this->search_media_candidates( $entity, $name, max( 10, $limit ) );

		usort( $candidates, array( $this, 'compare_search_candidates' ) );
		$candidates = array_slice( $candidates, 0, max( 1, $limit ) );

		if ( empty( $candidates ) ) {
			/* translators: 1: Entity type, 2: Entity name. */
			return new WP_Error( 'godam_mcp_entity_not_found', sprintf( __( 'No %1$s matched "%2$s".', 'godam' ), $entity, $name ), array( 'status' => 404 ) );
		}

		$resolved = $this->pick_resolved_candidate( $name, $candidates );
		if ( is_array( $resolved ) ) {
			return $resolved;
		}

		return new WP_Error(
			'godam_mcp_entity_ambiguous',
			/* translators: 1: Entity type, 2: Entity name, 3: Candidate summary. */
			sprintf( __( 'Ambiguous %1$s match for "%2$s". Top candidates: %3$s.', 'godam' ), $entity, $name, $this->summarize_candidates( $candidates ) ),
			array(
				'status'     => 409,
				'candidates' => array_slice( $candidates, 0, 3 ),
			)
		);
	}

	/**
	 * Resolve multiple entities using the same logic as the Node MCP server.
	 *
	 * @param string            $entity Entity type.
	 * @param array<int, mixed> $ids Exact ids.
	 * @param array<int, mixed> $names Fuzzy names.
	 * @param int               $limit Search candidate limit.
	 * @return array<string, mixed>|WP_Error
	 */
	private function resolve_entity_ids( $entity, array $ids, array $names, $limit = 5 ) {
		$resolved = array();

		foreach ( $ids as $entity_id ) {
			$entity_id = absint( $entity_id );
			if ( $entity_id > 0 ) {
				$resolved[] = array(
					'id'             => $entity_id,
					'matchType'      => 'id',
					'confidence'     => 1,
					'candidateCount' => 1,
				);
			}
		}

		foreach ( $names as $name ) {
			$resolved_entity = $this->resolve_entity_id( $entity, 0, sanitize_text_field( wp_unslash( (string) $name ) ), $limit );
			if ( is_wp_error( $resolved_entity ) ) {
				return $resolved_entity;
			}

			$resolved[] = $resolved_entity;
		}

		return array(
			'ids'      => array_values( array_unique( array_map( 'absint', wp_list_pluck( $resolved, 'id' ) ) ) ),
			'resolved' => $resolved,
		);
	}

	/**
	 * Pick a resolved candidate from a candidate list.
	 *
	 * @param string                           $name Search query.
	 * @param array<int, array<string, mixed>> $candidates Candidate list.
	 * @return array<string, mixed>|null
	 */
	private function pick_resolved_candidate( $name, array $candidates ) {
		$top_candidate = isset( $candidates[0] ) ? $candidates[0] : null;
		if ( ! is_array( $top_candidate ) ) {
			return null;
		}

		$exact_candidates = array_values(
			array_filter(
				$candidates,
				static function ( $candidate ) {
					return ! empty( $candidate['exact_match'] );
				}
			)
		);

		if ( 1 === count( $exact_candidates ) ) {
			$exact_candidate = $exact_candidates[0];
			return array(
				'id'                => (int) $exact_candidate['id'],
				'matchType'         => 'fuzzy',
				'confidence'        => 1,
				'candidateCount'    => count( $candidates ),
				'selectedCandidate' => $exact_candidate,
				'query'             => $name,
			);
		}

		if ( count( $exact_candidates ) > 1 ) {
			return null;
		}

		$second_candidate = isset( $candidates[1] ) ? $candidates[1] : null;
		$top_score        = isset( $top_candidate['score'] ) ? (float) $top_candidate['score'] : 0.0;
		$second_score     = isset( $second_candidate['score'] ) ? (float) $second_candidate['score'] : 0.0;

		if ( 1 === count( $candidates ) || $top_score >= 0.88 || ( $top_score - $second_score ) >= 0.08 ) {
			return array(
				'id'                => (int) $top_candidate['id'],
				'matchType'         => 'fuzzy',
				'confidence'        => $top_score,
				'candidateCount'    => count( $candidates ),
				'selectedCandidate' => $top_candidate,
				'query'             => $name,
			);
		}

		return null;
	}

	/**
	 * Summarize candidate list.
	 *
	 * @param array<int, array<string, mixed>> $candidates Candidates.
	 * @return string
	 */
	private function summarize_candidates( array $candidates ) {
		$labels = array();
		foreach ( array_slice( $candidates, 0, 3 ) as $candidate ) {
			$labels[] = sprintf(
				'%1$s (#%2$d%3$s, score %4$s)',
				(string) ( $candidate['label'] ?? '' ),
				(int) ( $candidate['id'] ?? 0 ),
				empty( $candidate['match_reason'] ) ? '' : ', ' . (string) $candidate['match_reason'],
				(string) ( $candidate['score'] ?? 0 )
			);
		}

		return implode( ', ', $labels );
	}

	/**
	 * Build the exact attachment details bridge envelope used internally by Phase 2 abilities.
	 *
	 * @param int $attachment_id Attachment id.
	 * @return array<string, mixed>|WP_Error
	 */
	private function build_attachment_details_bridge_envelope( $attachment_id ) {
		$attachment = $this->get_attachment_rest_payload( $attachment_id );
		if ( is_wp_error( $attachment ) ) {
			return $attachment;
		}

		$thumbnail_payload = $this->dispatch_media_library_callback(
			'get_video_thumbnail',
			array(
				'attachment_id' => $attachment_id,
			)
		);

		if ( is_wp_error( $thumbnail_payload ) ) {
			$thumbnail_payload = array(
				'success' => false,
				'data'    => array(
					'selected'         => '',
					'thumbnails'       => array(),
					'customThumbnails' => array(),
				),
			);
		}

		$status_map = $this->dispatch_transcoding_callback( 'get_transcoding_status', array( 'ids' => array( $attachment_id ) ), 'GET' );
		if ( is_wp_error( $status_map ) ) {
			return $status_map;
		}

		$meta                      = isset( $attachment['meta'] ) && is_array( $attachment['meta'] ) ? $attachment['meta'] : array();
		$status                    = $status_map[ (string) $attachment_id ] ?? $status_map[ $attachment_id ] ?? array();
		$custom_thumbnail          = isset( $meta['rtgodam_media_video_thumbnail'] ) ? (string) $meta['rtgodam_media_video_thumbnail'] : '';
		$hls_url                   = isset( $meta['rtgodam_hls_transcoded_url'] ) ? (string) $meta['rtgodam_hls_transcoded_url'] : '';
		$transcoded_url            = isset( $meta['rtgodam_transcoded_url'] ) ? (string) $meta['rtgodam_transcoded_url'] : '';
		$average_engagement        = $this->get_average_engagement_value( $attachment['rtgodam_analytics'] ?? null );
		$job_id                    = isset( $meta['rtgodam_transcoding_job_id'] ) ? (string) $meta['rtgodam_transcoding_job_id'] : '';
		$transcoding_error_code    = isset( $meta['rtgodam_transcoding_error_code'] ) ? (string) $meta['rtgodam_transcoding_error_code'] : '';
		$transcoding_error_message = isset( $meta['rtgodam_transcoding_error_msg'] ) ? (string) $meta['rtgodam_transcoding_error_msg'] : '';
		$issues                    = array();

		if ( '' === $job_id && 0 === strpos( (string) ( $attachment['mime_type'] ?? '' ), 'video/' ) ) {
			$issues[] = 'missing_job_id';
		}

		$media_sizes = isset( $attachment['media_details']['sizes'] ) && is_array( $attachment['media_details']['sizes'] ) ? $attachment['media_details']['sizes'] : array();
		if ( 'transcoded' === (string) ( $status['status'] ?? '' ) ) {
			if ( '' === $hls_url ) {
				$issues[] = 'missing_hls';
			}

			if ( '' === $custom_thumbnail && empty( $media_sizes ) ) {
				$issues[] = 'missing_thumbnail';
			}
		}

		$thumbnail_status = '' !== $custom_thumbnail ? 'custom' : ( ! empty( $media_sizes ) ? 'default' : 'missing' );

		return $this->build_bridge_envelope(
			array(
				'attachment_id'             => $attachment_id,
				'title'                     => (string) ( $attachment['title']['rendered'] ?? '' ),
				'mime_type'                 => (string) ( $attachment['mime_type'] ?? '' ),
				'source_url'                => (string) ( $attachment['source_url'] ?? '' ),
				'thumbnail_status'          => $thumbnail_status,
				'transcoding_status'        => (string) ( $status['status'] ?? ( '' !== $job_id ? 'not_started' : 'not_transcoding' ) ),
				'transcoding_progress'      => (int) ( $status['progress'] ?? 0 ),
				'transcoding_job_id'        => $job_id,
				'transcoding_error_code'    => $transcoding_error_code,
				'transcoding_error_message' => $transcoding_error_message,
				'hls_url_present'           => '' !== $hls_url,
				'hls_url'                   => $hls_url,
				'transcoded_url_present'    => '' !== $transcoded_url,
				'transcoded_url'            => $transcoded_url,
				'average_engagement'        => $average_engagement,
				'rtgodam_meta_present'      => ! empty( $attachment['rtgodam_meta'] ),
				'rtgodam_analytics_present' => ! empty( $attachment['rtgodam_analytics'] ),
				'is_virtual_media'          => ! empty( $meta['_godam_original_id'] ),
				'godam_original_id'         => isset( $meta['_godam_original_id'] ) ? (string) $meta['_godam_original_id'] : '',
				'health_status'             => ! empty( $issues ) ? $issues[0] : 'healthy',
				'attachment'                => $attachment,
				'issues'                    => $issues,
				'thumbnail_payload'         => $thumbnail_payload,
			),
			sprintf( 'Attachment %1$d loaded with health status %2$s.', $attachment_id, ! empty( $issues ) ? $issues[0] : 'healthy' ),
			array(
				'attachment' => $this->build_source_status(),
				'thumbnail'  => $this->build_source_status(),
				'status'     => $this->build_source_status(),
			)
		);
	}

	/**
	 * Build the exact upload or transcode status envelope used by the Node MCP server.
	 *
	 * @param int $attachment_id Attachment id.
	 * @return array<string, mixed>|WP_Error
	 */
	private function build_upload_or_transcode_status_envelope( $attachment_id ) {
		$attachment_details = $this->build_attachment_details_bridge_envelope( $attachment_id );
		if ( is_wp_error( $attachment_details ) ) {
			return $attachment_details;
		}

		$status       = strtolower( (string) ( $attachment_details['data']['transcoding_status'] ?? 'unknown' ) );
		$ready_to_use = 'transcoded' === $status && ( ! empty( $attachment_details['data']['hls_url_present'] ) || ! empty( $attachment_details['data']['transcoded_url_present'] ) );
		$terminal     = in_array( $status, array( 'transcoded', 'failed', 'blocked' ), true );
		$attachment   = isset( $attachment_details['data']['attachment'] ) && is_array( $attachment_details['data']['attachment'] ) ? $attachment_details['data']['attachment'] : array();
		$meta         = isset( $attachment['meta'] ) && is_array( $attachment['meta'] ) ? $attachment['meta'] : array();

		return $this->build_bridge_envelope(
			array(
				'attachment_id'      => $attachment_id,
				'title'              => (string) ( $attachment_details['data']['title'] ?? '' ),
				'current_status'     => $status,
				'progress'           => (int) ( $attachment_details['data']['transcoding_progress'] ?? 0 ),
				'ready_to_use'       => $ready_to_use,
				'terminal'           => $terminal,
				'transcoding_job_id' => (string) ( $attachment_details['data']['transcoding_job_id'] ?? '' ),
				'source_url'         => (string) ( $attachment_details['data']['source_url'] ?? '' ),
				'hls_url'            => (string) ( $attachment_details['data']['hls_url'] ?? '' ),
				'transcoded_url'     => (string) ( $attachment_details['data']['transcoded_url'] ?? '' ),
				'thumbnail_url'      => isset( $meta['rtgodam_media_video_thumbnail'] ) ? (string) $meta['rtgodam_media_video_thumbnail'] : '',
				'thumbnail_status'   => (string) ( $attachment_details['data']['thumbnail_status'] ?? 'unknown' ),
				'health_status'      => (string) ( $attachment_details['data']['health_status'] ?? 'unknown' ),
				'average_engagement' => (float) ( $attachment_details['data']['average_engagement'] ?? 0 ),
				'error_code'         => (string) ( $attachment_details['data']['transcoding_error_code'] ?? '' ),
				'error_message'      => (string) ( $attachment_details['data']['transcoding_error_message'] ?? '' ),
				'attachment'         => $attachment,
				'issues'             => isset( $attachment_details['data']['issues'] ) && is_array( $attachment_details['data']['issues'] ) ? $attachment_details['data']['issues'] : array(),
				'polling'            => null,
			),
			sprintf( 'Attachment %1$d is currently %2$s.', $attachment_id, $status ),
			isset( $attachment_details['source_status'] ) && is_array( $attachment_details['source_status'] ) ? $attachment_details['source_status'] : array(),
			isset( $attachment_details['errors'] ) && is_array( $attachment_details['errors'] ) ? $attachment_details['errors'] : array()
		);
	}

	/**
	 * Execute the upload bridge flow.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @param bool                      $supports_wait Whether waitForCompletion is supported.
	 * @return array<string, mixed>|WP_Error
	 */
	private function execute_upload_video_bridge( $input, $supports_wait ) {
		if ( empty( $input['localFilePath'] ) && empty( $input['attachmentUri'] ) && empty( $input['remoteUrl'] ) ) {
			return new WP_Error( 'godam_mcp_missing_upload_source', __( 'A localFilePath, attachmentUri, or remoteUrl is required.', 'godam' ), array( 'status' => 400 ) );
		}

		$confirm             = ! empty( $input['confirm'] );
		$wait_for_completion = $supports_wait && ! empty( $input['waitForCompletion'] );
		$source              = $this->resolve_upload_source_from_input( is_array( $input ) ? $input : array() );
		if ( is_wp_error( $source ) ) {
			return $source;
		}

		$resolved_folder = null;
		if ( ! empty( $input['folderId'] ) || ! empty( $input['folderName'] ) ) {
			$resolved_folder = $this->resolve_entity_id(
				'folder',
				isset( $input['folderId'] ) ? absint( $input['folderId'] ) : 0,
				isset( $input['folderName'] ) ? sanitize_text_field( wp_unslash( (string) $input['folderName'] ) ) : '',
				isset( $input['resolutionLimit'] ) ? absint( $input['resolutionLimit'] ) : 5
			);
			if ( is_wp_error( $resolved_folder ) ) {
				$this->cleanup_upload_source( $source );
				return $resolved_folder;
			}
		}

		if ( ! $confirm ) {
			$response = $this->build_bridge_envelope(
				array(
					'validation_only'     => true,
					'confirm'             => false,
					'upload_mode'         => (string) $source['upload_mode'],
					'requested_source'    => (string) $source['requested_source'],
					'requested_title'     => isset( $input['title'] ) ? trim( (string) $input['title'] ) : '',
					'resolved_folder'     => is_array( $resolved_folder ) ? $resolved_folder : null,
					'uploaded_attachment' => null,
					'folder_assignment'   => null,
					'status'              => null,
					'write_result'        => null,
				),
				$wait_for_completion
					? sprintf( 'Validation succeeded for %1$s. Re-run with confirm=true to upload it and track transcoding.', $source['filename'] )
					: sprintf( 'Validation succeeded for %1$s. Re-run with confirm=true to upload it into WordPress media and trigger GoDAM transcoding.', $source['filename'] )
			);
			$this->cleanup_upload_source( $source );
			return $response;
		}

		$uploaded_attachment = $this->upload_video_source_to_wordpress(
			$source,
			isset( $input['title'] ) ? (string) $input['title'] : ''
		);
		if ( is_wp_error( $uploaded_attachment ) ) {
			$this->cleanup_upload_source( $source );
			return $uploaded_attachment;
		}

		$folder_assignment = null;
		$write_result      = $uploaded_attachment['raw_attachment'];
		if ( is_array( $resolved_folder ) ) {
			$assignment = $this->assign_media_to_folder_exact( array( (int) $uploaded_attachment['attachment_id'] ), (int) $resolved_folder['id'] );
			if ( is_wp_error( $assignment ) ) {
				$this->cleanup_upload_source( $source );
				return $assignment;
			}

			$assigned_folder   = isset( $assignment['data']['folder'] ) && is_array( $assignment['data']['folder'] ) ? $assignment['data']['folder'] : array();
			$verification      = isset( $assignment['data']['verification'] ) && is_array( $assignment['data']['verification'] ) ? $assignment['data']['verification'] : null;
			$folder_assignment = array(
				'folder_id'    => (int) $resolved_folder['id'],
				'folder_name'  => (string) ( $assigned_folder['name'] ?? ( $resolved_folder['selectedCandidate']['label'] ?? '' ) ),
				'verification' => $verification,
			);
			$write_result      = array(
				'upload'            => $uploaded_attachment['raw_attachment'],
				'folder_assignment' => $assignment['data']['write_result'] ?? $assignment['data'],
			);
		}

		$status = $wait_for_completion
			? $this->poll_upload_or_transcode_status_envelope(
				(int) $uploaded_attachment['attachment_id'],
				isset( $input['timeoutMs'] ) ? absint( $input['timeoutMs'] ) : 300000,
				isset( $input['pollIntervalMs'] ) ? absint( $input['pollIntervalMs'] ) : 3000
			)
			: $this->build_upload_or_transcode_status_envelope( (int) $uploaded_attachment['attachment_id'] );

		$this->cleanup_upload_source( $source );

		if ( is_wp_error( $status ) ) {
			return $status;
		}

		return $this->build_bridge_envelope(
			array(
				'validation_only'     => false,
				'confirm'             => true,
				'upload_mode'         => (string) $source['upload_mode'],
				'requested_source'    => (string) $source['requested_source'],
				'requested_title'     => isset( $input['title'] ) ? trim( (string) $input['title'] ) : '',
				'resolved_folder'     => is_array( $resolved_folder ) ? $resolved_folder : null,
				'uploaded_attachment' => $uploaded_attachment,
				'folder_assignment'   => $folder_assignment,
				'status'              => $status['data'],
				'write_result'        => $write_result,
			),
			$wait_for_completion
				? (string) $status['summary']
				: ( $supports_wait
					? sprintf( 'Uploaded video attachment %1$d. Re-run godam_get_upload_or_transcode_status to continue polling.', $uploaded_attachment['attachment_id'] )
					: ( is_array( $resolved_folder )
						? sprintf( 'Uploaded video attachment %1$d and assigned it to folder %2$d.', $uploaded_attachment['attachment_id'], $resolved_folder['id'] )
						: sprintf( 'Uploaded video attachment %1$d.', $uploaded_attachment['attachment_id'] ) ) ),
			isset( $status['source_status'] ) && is_array( $status['source_status'] ) ? $status['source_status'] : array(),
			isset( $status['errors'] ) && is_array( $status['errors'] ) ? $status['errors'] : array()
		);
	}

	/**
	 * Poll upload or transcode status until completion.
	 *
	 * @param int $attachment_id Attachment id.
	 * @param int $timeout_ms Timeout in milliseconds.
	 * @param int $poll_interval_ms Poll interval in milliseconds.
	 * @return array<string, mixed>|WP_Error
	 */
	private function poll_upload_or_transcode_status_envelope( $attachment_id, $timeout_ms, $poll_interval_ms ) {
		$timeout_ms       = max( 1, min( 900000, (int) $timeout_ms ) );
		$poll_interval_ms = max( 1, min( 60000, (int) $poll_interval_ms ) );
		$started_at       = microtime( true );
		$checkpoints      = array();
		$latest           = $this->build_upload_or_transcode_status_envelope( $attachment_id );

		if ( is_wp_error( $latest ) ) {
			return $latest;
		}

		while ( ( ( microtime( true ) - $started_at ) * 1000 ) < $timeout_ms && empty( $latest['data']['ready_to_use'] ) && empty( $latest['data']['terminal'] ) ) {
			$checkpoints[] = array(
				'checked_at' => gmdate( 'c' ),
				'status'     => (string) $latest['data']['current_status'],
				'progress'   => (int) $latest['data']['progress'],
			);

			if ( ( ( microtime( true ) - $started_at ) * 1000 ) + $poll_interval_ms >= $timeout_ms ) {
				break;
			}

			usleep( $poll_interval_ms * 1000 );
			$latest = $this->build_upload_or_transcode_status_envelope( $attachment_id );
			if ( is_wp_error( $latest ) ) {
				return $latest;
			}
		}

		$elapsed_ms                = (int) round( ( microtime( true ) - $started_at ) * 1000 );
		$latest['data']['polling'] = array(
			'wait_requested'   => true,
			'polls_completed'  => count( $checkpoints ) + 1,
			'elapsed_ms'       => $elapsed_ms,
			'timed_out'        => empty( $latest['data']['ready_to_use'] ) && empty( $latest['data']['terminal'] ),
			'poll_interval_ms' => $poll_interval_ms,
			'timeout_ms'       => $timeout_ms,
			'checkpoints'      => $checkpoints,
		);

		if ( ! empty( $latest['data']['ready_to_use'] ) ) {
			$latest['summary'] = sprintf( 'Attachment %1$d finished transcoding and is ready to use.', $attachment_id );
		} elseif ( ! empty( $latest['data']['terminal'] ) ) {
			$latest['summary'] = sprintf( 'Attachment %1$d reached terminal status %2$s.', $attachment_id, (string) $latest['data']['current_status'] );
		} else {
			$latest['summary'] = sprintf( 'Attachment %1$d is still %2$s after polling.', $attachment_id, (string) $latest['data']['current_status'] );
		}

		return $latest;
	}

	/**
	 * Get a REST payload for an attachment with context=edit.
	 *
	 * @param int $attachment_id Attachment id.
	 * @return array<string, mixed>|WP_Error
	 */
	private function get_attachment_rest_payload( $attachment_id ) {
		$request = new WP_REST_Request( 'GET', '/wp/v2/media/' . $attachment_id );
		$request->set_param( 'context', 'edit' );
		$response = rest_do_request( $request );

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		if ( $response instanceof WP_REST_Response ) {
			$status = $response->get_status();
			$data   = $response->get_data();
			if ( $status >= 400 ) {
				return new WP_Error( 'godam_mcp_attachment_load_failed', is_array( $data ) && isset( $data['message'] ) ? (string) $data['message'] : __( 'Failed to load attachment.', 'godam' ), array( 'status' => $status ) );
			}

			return is_array( $data ) ? $data : array();
		}

		return is_array( $response ) ? $response : array();
	}

	/**
	 * Assign media to a folder with the exact Node MCP envelope.
	 *
	 * @param array<int> $attachment_ids Attachment ids.
	 * @param int        $folder_id Folder id.
	 * @return array<string, mixed>|WP_Error
	 */
	private function assign_media_to_folder_exact( array $attachment_ids, $folder_id ) {
		$before_count = $this->dispatch_media_library_callback( 'get_count_by_category', array( 'folder_id' => $folder_id ) );
		if ( is_wp_error( $before_count ) ) {
			return $before_count;
		}

		$write_result = $this->dispatch_media_library_callback(
			'assign_images_to_folder',
			array(
				'attachment_ids' => $attachment_ids,
				'folder_term_id' => $folder_id,
			),
			'POST'
		);
		if ( is_wp_error( $write_result ) ) {
			return $write_result;
		}

		$folder_snapshot = $this->dispatch_media_library_callback(
			'get_media_folders',
			array(
				'page'     => 1,
				'per_page' => 100,
			) 
		);
		if ( is_wp_error( $folder_snapshot ) ) {
			return $folder_snapshot;
		}

		$after_count = $this->dispatch_media_library_callback( 'get_count_by_category', array( 'folder_id' => $folder_id ) );
		if ( is_wp_error( $after_count ) ) {
			return $after_count;
		}

		$prepared_folders = array_map( array( $this, 'normalize_folder_record_exact' ), is_array( $folder_snapshot ) ? $folder_snapshot : array() );
		$target_folder    = null;
		foreach ( $prepared_folders as $prepared_folder ) {
			if ( (int) $prepared_folder['folder_id'] === (int) $folder_id ) {
				$target_folder = $prepared_folder;
				break;
			}
		}

		$before = (int) ( $before_count['count'] ?? 0 );
		$after  = (int) ( $after_count['count'] ?? 0 );

		return $this->build_bridge_envelope(
			array(
				'attachment_ids' => array_values( array_map( 'absint', $attachment_ids ) ),
				'assigned_count' => count( $attachment_ids ),
				'folder_id'      => (int) $folder_id,
				'folder'         => $target_folder,
				'verification'   => array(
					'before_count' => $before,
					'after_count'  => $after,
					'delta'        => $after - $before,
				),
				'write_result'   => $write_result,
			),
			isset( $write_result['message'] ) ? (string) $write_result['message'] : sprintf( 'Assigned %1$d media item(s) to folder %2$d.', count( $attachment_ids ), $folder_id ),
			array(
				'write'        => $this->build_source_status(),
				'before_count' => $this->build_source_status(),
				'after_count'  => $this->build_source_status(),
				'folders'      => $this->build_source_status(),
			),
			array(),
			empty( $write_result['success'] ) ? true : (bool) $write_result['success']
		);
	}

	/**
	 * Resolve an upload source from ability input.
	 *
	 * @param array<string, mixed> $input Ability input.
	 * @return array<string, mixed>|WP_Error
	 */
	private function resolve_upload_source_from_input( array $input ) {
		$local_file_path = isset( $input['localFilePath'] ) ? trim( (string) $input['localFilePath'] ) : '';
		$attachment_uri  = isset( $input['attachmentUri'] ) ? trim( (string) $input['attachmentUri'] ) : '';
		$remote_url      = isset( $input['remoteUrl'] ) ? trim( (string) $input['remoteUrl'] ) : '';

		if ( '' !== $local_file_path && '' !== $attachment_uri ) {
			return new WP_Error( 'godam_mcp_invalid_upload_source', __( 'Provide either localFilePath or attachmentUri, not both.', 'godam' ), array( 'status' => 400 ) );
		}

		if ( ( '' !== $local_file_path || '' !== $attachment_uri ) && '' !== $remote_url ) {
			return new WP_Error( 'godam_mcp_invalid_upload_source', __( 'Provide either a local path or attachment URI, or a remoteUrl, not both.', 'godam' ), array( 'status' => 400 ) );
		}

		if ( '' !== $attachment_uri ) {
			return $this->prepare_local_upload_source( $this->resolve_upload_path( $attachment_uri ), 'attachment_uri', $attachment_uri );
		}

		if ( '' !== $local_file_path ) {
			return $this->prepare_local_upload_source( $this->resolve_upload_path( $local_file_path ), 'local_path', $local_file_path );
		}

		if ( '' === $remote_url ) {
			return new WP_Error( 'godam_mcp_missing_upload_source', __( 'A localFilePath, attachmentUri, or remoteUrl is required.', 'godam' ), array( 'status' => 400 ) );
		}

		return $this->prepare_remote_upload_source( $remote_url );
	}

	/**
	 * Resolve a filesystem path from a path or file URI.
	 *
	 * @param string $value Path or URI.
	 * @return string
	 */
}
