<?php
/**
 * MCP abilities partial: Abilities_Search.
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
 * Abilities_Search trait.
 */
trait Abilities_Search {

	/**
	 * Search media folder candidates for MCP entity resolution.
	 *
	 * @param string $query Search query.
	 * @return array<int, array<string, mixed>>
	 */
	private function search_folder_candidates( $query ) {
		$terms      = get_terms(
			array(
				'taxonomy'   => 'media-folder',
				'hide_empty' => false,
				'number'     => 100,
			)
		);
		$candidates = array();

		if ( is_wp_error( $terms ) || ! is_array( $terms ) ) {
			return $candidates;
		}

		foreach ( $terms as $term ) {
			$normalized_name  = $this->normalize_search_text( $term->name );
			$normalized_query = $this->normalize_search_text( $query );
			$id_exact_match   = trim( $query ) === (string) $term->term_id;
			$name_exact_match = $normalized_name === $normalized_query;
			$score            = $id_exact_match ? 1.0 : $this->score_search_match( $query, $term->name );

			if ( $score < 0.2 && ! $id_exact_match && ! $name_exact_match ) {
				continue;
			}

			$candidates[] = array(
				'id'           => (int) $term->term_id,
				'label'        => (string) $term->name,
				'name'         => (string) $term->name,
				'parent'       => (int) $term->parent,
				'entity'       => 'folder',
				'score'        => $score,
				'exact_match'  => $id_exact_match || $name_exact_match,
				'match_reason' => $id_exact_match ? 'id' : ( $name_exact_match ? 'name' : 'fuzzy' ),
			);
		}

		return $candidates;
	}

	/**
	 * Search media candidates.
	 *
	 * @param string $entity Search entity.
	 * @param string $query Search query.
	 * @param int    $per_page Result size.
	 * @return array<int, array<string, mixed>>
	 */
	private function search_media_candidates( $entity, $query, $per_page ) {
		$args = array(
			'post_type'      => 'attachment',
			'post_status'    => 'any',
			'posts_per_page' => $per_page,
			's'              => $query,
		);

		if ( 'video' === $entity ) {
			$args['post_mime_type'] = 'video';
		}

		$attachments = get_posts( $args );
		if ( ctype_digit( trim( $query ) ) ) {
			$direct_attachment = get_post( (int) $query );
			if ( $direct_attachment instanceof \WP_Post && 'attachment' === $direct_attachment->post_type ) {
				$attachments[] = $direct_attachment;
			}
		}

		$candidates = array();
		$seen_ids   = array();

		foreach ( $attachments as $attachment ) {
			if ( ! $attachment instanceof \WP_Post || 'attachment' !== $attachment->post_type ) {
				continue;
			}

			if ( isset( $seen_ids[ $attachment->ID ] ) ) {
				continue;
			}

			$mime_type = (string) get_post_mime_type( $attachment->ID );
			if ( 'video' === $entity && 0 !== strpos( $mime_type, 'video/' ) ) {
				continue;
			}

			$title                = (string) get_the_title( $attachment->ID );
			$slug                 = (string) $attachment->post_name;
			$source_url           = (string) wp_get_attachment_url( $attachment->ID );
			$filename             = wp_basename( wp_parse_url( $source_url, PHP_URL_PATH ) );
			$normalized_query     = $this->normalize_search_text( $query );
			$id_text              = (string) $attachment->ID;
			$id_exact_match       = ctype_digit( trim( $query ) ) && trim( $query ) === $id_text;
			$title_exact_match    = '' !== $title && $this->normalize_search_text( $title ) === $normalized_query;
			$slug_exact_match     = '' !== $slug && $this->normalize_search_text( $slug ) === $normalized_query;
			$filename_exact_match = '' !== $filename && $this->normalize_search_text( $filename ) === $normalized_query;
			$score                = $id_exact_match
				? 1.0
				: max(
					$this->score_search_match( $query, $title ),
					$this->score_search_match( $query, $slug ),
					$this->score_search_match( $query, $filename ),
					$this->score_search_match( $query, $id_text )
				);

			if ( $score < 0.2 && ! $title_exact_match && ! $slug_exact_match && ! $filename_exact_match ) {
				continue;
			}

			$candidates[] = array(
				'id'           => (int) $attachment->ID,
				'label'        => '' !== $title ? $title : ( '' !== $slug ? $slug : $filename ),
				'title'        => $title,
				'slug'         => $slug,
				'filename'     => $filename,
				'source_url'   => $source_url,
				'mime_type'    => $mime_type,
				'entity'       => $entity,
				'score'        => $score,
				'exact_match'  => $id_exact_match || $title_exact_match || $slug_exact_match || $filename_exact_match,
				'match_reason' => $id_exact_match ? 'id' : ( $slug_exact_match ? 'slug' : ( $title_exact_match ? 'title' : ( $filename_exact_match ? 'filename' : 'fuzzy' ) ) ),
			);

			$seen_ids[ $attachment->ID ] = true;
		}

		return $candidates;
	}

	/**
	 * Compare search candidates.
	 *
	 * @param array<string, mixed> $left Left candidate.
	 * @param array<string, mixed> $right Right candidate.
	 * @return int
	 */
	private function compare_search_candidates( array $left, array $right ) {
		$exact_compare = ( (int) ! empty( $right['exact_match'] ) ) <=> ( (int) ! empty( $left['exact_match'] ) );
		if ( 0 !== $exact_compare ) {
			return $exact_compare;
		}

		return ( (float) ( $right['score'] ?? 0 ) ) <=> ( (float) ( $left['score'] ?? 0 ) );
	}

	/**
	 * Normalize search text.
	 *
	 * @param string $text Search text.
	 * @return string
	 */
	private function normalize_search_text( $text ) {
		$text = strtolower( trim( (string) $text ) );
		$text = preg_replace( '/\.[a-z0-9]{2,5}$/i', '', $text );
		$text = preg_replace( '/[^a-z0-9\s]+/', ' ', $text );
		$text = preg_replace( '/\s+/', ' ', $text );

		return trim( (string) $text );
	}

	/**
	 * Score a search match between 0 and 1.
	 *
	 * @param string $query Search query.
	 * @param string $candidate Candidate text.
	 * @return float
	 */
	private function score_search_match( $query, $candidate ) {
		$normalized_query     = $this->normalize_search_text( $query );
		$normalized_candidate = $this->normalize_search_text( $candidate );

		if ( '' === $normalized_query || '' === $normalized_candidate ) {
			return 0.0;
		}

		if ( $normalized_query === $normalized_candidate ) {
			return 1.0;
		}

		$score = 0.0;
		if ( false !== strpos( $normalized_candidate, $normalized_query ) ) {
			$score = max( $score, 0.9 );
		}

		if ( false !== strpos( $normalized_query, $normalized_candidate ) ) {
			$score = max( $score, 0.75 );
		}

		$query_tokens     = array_values( array_filter( explode( ' ', $normalized_query ) ) );
		$candidate_tokens = array_values( array_filter( explode( ' ', $normalized_candidate ) ) );
		$overlap          = count( array_intersect( $query_tokens, $candidate_tokens ) );

		if ( ! empty( $query_tokens ) && ! empty( $candidate_tokens ) ) {
			$score = max( $score, $overlap / max( count( $query_tokens ), count( $candidate_tokens ) ) );
		}

		return min( 1.0, $score );
	}

	/**
	 * Return average engagement from analytics meta.
	 *
	 * @param mixed $analytics Analytics meta.
	 * @return float
	 */
}
