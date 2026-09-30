<?php
/**
 * Unit tests for the Engagement REST route's handling of commenter details.
 *
 * The comments a visitor sees come back from a public route, so they may carry
 * the display name, the avatar and an `is_own` flag for that viewer, and nothing
 * else about the author. Editing and deleting are decided on the site from the
 * WordPress session, never from anything the browser sends.
 *
 * GoDAM Central is faked through the wp_remote_post() stub (see
 * tests/stubs/engagement-functions.php): each test sets who is signed in and
 * what Central holds, then checks the route's output and the calls it made.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\Engagement;

/**
 * @covers \RTGODAM\Inc\REST_API\Engagement::get_activities
 * @covers \RTGODAM\Inc\REST_API\Engagement::get_comments
 * @covers \RTGODAM\Inc\REST_API\Engagement::is_own_comment
 * @covers \RTGODAM\Inc\REST_API\Engagement::user_comment
 * @covers \RTGODAM\Inc\REST_API\Engagement::user_delete_comment
 * @covers \RTGODAM\Inc\REST_API\Engagement::engagement_permission_check
 */
class EngagementCommentPrivacyTest extends TestCase {

	private const ALICE = 'test-w10-alice@example.com';
	private const BOB   = 'test-w10-bob@example.com';

	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_stub'] = array(
			'options'      => array(
				'rtgodam-account-token' => 'verified-account',
				'rtgodam-api-key'       => 'test-key',
			),
			// Views analytics call, made by get_activities().
			'http'         => array(
				'code' => 200,
				'body' => wp_json_encode( array( 'processed_analytics' => array( 'post_views' => array( 3, 4 ) ) ) ),
			),
			'post_handler' => array( $this, 'central' ),
		);

		// Alice wrote a top-level comment and a reply; Bob replied to her.
		$this->set_central_comments(
			array(
				$this->comment_row( 'c-alice', self::ALICE, 'Alice', null ),
				$this->comment_row( 'c-bob', self::BOB, 'Bob', 'c-alice' ),
				$this->comment_row( 'c-alice-2', self::ALICE, 'Alice', 'c-alice' ),
			)
		);
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'] );
		parent::tearDown();
	}

	/**
	 * Engagement instance without Base's constructor (it registers WP hooks).
	 *
	 * @return Engagement
	 */
	private function engagement() {
		return ( new \ReflectionClass( Engagement::class ) )->newInstanceWithoutConstructor();
	}

	/**
	 * Sign in as a user, or pass null to be a logged-out visitor.
	 *
	 * @param string|null $email Email of the WordPress user.
	 * @param string      $name  Display name.
	 */
	private function sign_in_as( $email, $name = 'Someone' ) {
		if ( null === $email ) {
			unset( $GLOBALS['rtgodam_stub']['user'] );
			return;
		}
		$GLOBALS['rtgodam_stub']['user'] = array(
			'email' => $email,
			'name'  => $name,
		);
	}

	/**
	 * A comment as GoDAM Central returns it.
	 *
	 * @param string      $name     Comment ID.
	 * @param string      $email    Author email.
	 * @param string      $by       Author display name.
	 * @param string|null $reply_to ID of the parent comment.
	 * @return array
	 */
	private function comment_row( $name, $email, $by, $reply_to ) {
		return array(
			'name'            => $name,
			'creation'        => '2026-09-01 10:00:00',
			'content'         => '<p>Comment ' . $name . '</p>',
			'comment_by'      => $by,
			'comment_email'   => $email,
			'custom_reply_to' => $reply_to,
		);
	}

	/**
	 * Set the comments Central holds for the video.
	 *
	 * @param array $rows Comment rows.
	 */
	private function set_central_comments( array $rows ) {
		$GLOBALS['rtgodam_stub']['central_comments'] = $rows;
	}

	/**
	 * Fake GoDAM Central, keyed on the endpoint the plugin calls.
	 *
	 * @param string $url  Endpoint URL.
	 * @param array  $args Request args.
	 * @return array
	 */
	public function central( $url, $args ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- callback signature is fixed by the stub.
		$stub = $GLOBALS['rtgodam_stub'];

		if ( isset( $stub['central_down'] ) ) {
			return array(
				'code' => 500,
				'body' => '{}',
			);
		}

		if ( false !== strpos( $url, 'get_wp_comments' ) ) {
			// Like Central: newest first, and only the newest 20 unless asked for more.
			$body = json_decode( $args['body'], true );
			$rows = $stub['central_comments'];
			usort(
				$rows,
				static function ( $a, $b ) {
					return strcmp( $b['creation'], $a['creation'] );
				}
			);
			$limit   = isset( $stub['central_ignores_paging'] ) ? 20 : ( $body['limit'] ?? 20 );
			$start   = isset( $stub['central_ignores_paging'] ) ? 0 : ( $body['start'] ?? 0 );
			$message = array(
				'comments' => array_slice( $rows, $start, $limit ),
				'count'    => count( $rows ),
			);
		} elseif ( false !== strpos( $url, 'get_wp_likes' ) ) {
			$message = array(
				'status'            => 'success',
				'likes'             => 2,
				'has_liked_by_user' => false,
			);
		} else {
			// wp_comment, wp_update_comment, delete_comment.
			$message = array(
				'status' => 'success',
				'data'   => $this->comment_row( 'c-new', self::ALICE, 'Alice', null ),
			);
		}

		return array(
			'code' => 200,
			'body' => wp_json_encode( array( 'message' => $message ) ),
		);
	}

	/**
	 * Calls the plugin made to Central, other than reading.
	 *
	 * @return array List of array( 'url', 'body' ).
	 */
	private function central_writes() {
		$writes = array();
		foreach ( $GLOBALS['rtgodam_stub']['posts'] ?? array() as $post ) {
			if ( false !== strpos( $post['url'], 'get_wp_' ) ) {
				continue;
			}
			$writes[] = array(
				'url'  => $post['url'],
				'body' => json_decode( $post['args']['body'], true ),
			);
		}
		return $writes;
	}

	/**
	 * Run GET /engagement/activities and return the response.
	 *
	 * @return \WP_REST_Response
	 */
	private function get_activities() {
		return $this->engagement()->get_activities(
			new \WP_REST_Request(
				array(
					'video_id' => 'cmmid_job-1',
					'site_url' => 'https://www.example.com',
				)
			)
		);
	}

	/**
	 * Flatten a comment tree into a map of comment ID to comment.
	 *
	 * @param array $tree Comments, each with `children`.
	 * @return array
	 */
	private function flatten( array $tree ) {
		$flat = array();
		foreach ( $tree as $comment ) {
			$flat[ $comment['id'] ] = $comment;
			$flat                   = array_merge( $flat, $this->flatten( $comment['children'] ) );
		}
		return $flat;
	}

	/** A logged-out visitor gets the comments, with no email anywhere in the response. */
	public function test_logged_out_response_has_no_email() {
		$response = $this->get_activities();
		$body     = wp_json_encode( $response->get_data() );

		$this->assertSame( 200, $response->get_status() );
		$this->assertStringNotContainsString( self::ALICE, $body );
		$this->assertStringNotContainsString( self::BOB, $body );
		$this->assertStringNotContainsString( '@', $body );
		$this->assertStringNotContainsString( 'author_email', $body );

		$comments = $this->flatten( $response->get_data()['data']['comments'] );
		$this->assertCount( 3, $comments );
		foreach ( $comments as $comment ) {
			$this->assertArrayNotHasKey( 'author_email', $comment );
			$this->assertFalse( $comment['is_own'] );
		}
	}

	/** The name and avatar still come back, and the tree keeps its shape. */
	public function test_name_avatar_and_replies_are_kept() {
		$comments = $this->get_activities()->get_data()['data']['comments'];

		$this->assertCount( 1, $comments );
		$this->assertSame( 'c-alice', $comments[0]['id'] );
		$this->assertSame( 'Alice', $comments[0]['author_name'] );
		$this->assertSame( 'https://avatar.test/' . md5( self::ALICE ) . '?s=96', $comments[0]['author_image'] );
		$this->assertSame( 'Comment c-alice', $comments[0]['text'] );
		$this->assertSame( array( 'c-bob', 'c-alice-2' ), array_column( $comments[0]['children'], 'id' ) );
		$this->assertSame( 3, $this->get_activities()->get_data()['data']['comments_count'] );
	}

	/** The owner is flagged on their own comments, replies included, and nobody else's. */
	public function test_owner_is_flagged_on_their_own_comments() {
		$this->sign_in_as( self::ALICE, 'Alice' );

		$response = $this->get_activities();
		$comments = $this->flatten( $response->get_data()['data']['comments'] );

		$this->assertTrue( $comments['c-alice']['is_own'] );
		$this->assertTrue( $comments['c-alice-2']['is_own'] );
		$this->assertFalse( $comments['c-bob']['is_own'] );
		$this->assertStringNotContainsString( '@', wp_json_encode( $response->get_data() ) );
	}

	/** The owner match ignores case and stray spaces in the stored email. */
	public function test_owner_match_ignores_case_and_spaces() {
		$this->set_central_comments(
			array( $this->comment_row( 'c-alice', '  Test-W10-Alice@Example.com ', 'Alice', null ) )
		);
		$this->sign_in_as( self::ALICE, 'Alice' );

		$comments = $this->get_activities()->get_data()['data']['comments'];

		$this->assertTrue( $comments[0]['is_own'] );
	}

	/** A different signed-in user owns nothing here. */
	public function test_another_user_owns_nothing() {
		$this->sign_in_as( 'test-w10-carol@example.com', 'Carol' );

		$comments = $this->flatten( $this->get_activities()->get_data()['data']['comments'] );

		foreach ( $comments as $comment ) {
			$this->assertFalse( $comment['is_own'] );
		}
	}

	/** A visitor who is not signed in is never an owner, even against the placeholder address. */
	public function test_guest_never_owns_a_comment() {
		$this->set_central_comments(
			array( $this->comment_row( 'c-anon', 'anonymous@example.com', 'Anonymous', null ) )
		);
		$this->sign_in_as( null );

		$comments = $this->get_activities()->get_data()['data']['comments'];

		$this->assertFalse( $comments[0]['is_own'] );
		$this->assertFalse( $this->engagement()->is_own_comment( 'anonymous@example.com' ) );
	}

	/** The comment list is cached for everyone, and the flag is still worked out for each viewer. */
	public function test_cached_comments_are_flagged_per_viewer() {
		$this->sign_in_as( self::ALICE, 'Alice' );
		$as_alice = $this->flatten( $this->get_activities()->get_data()['data']['comments'] );

		$this->sign_in_as( self::BOB, 'Bob' );
		$response = $this->get_activities();
		$as_bob   = $this->flatten( $response->get_data()['data']['comments'] );

		$comment_reads = array_filter(
			$GLOBALS['rtgodam_stub']['posts'],
			static function ( $post ) {
				return false !== strpos( $post['url'], 'get_wp_comments' );
			}
		);
		$this->assertCount( 1, $comment_reads, 'The second viewer is served from the cache.' );
		$this->assertTrue( $as_alice['c-alice']['is_own'] );
		$this->assertFalse( $as_bob['c-alice']['is_own'] );
		$this->assertTrue( $as_bob['c-bob']['is_own'] );
		$this->assertStringNotContainsString( '@', wp_json_encode( $response->get_data() ) );
	}

	/** Deleting someone else's comment is refused and nothing reaches Central. */
	public function test_delete_of_another_users_comment_is_refused() {
		$this->sign_in_as( self::BOB, 'Bob' );

		foreach ( array( 'hard-delete', 'soft-delete' ) as $delete_type ) {
			$response = $this->engagement()->user_delete_comment(
				new \WP_REST_Request(
					array(
						'video_id'    => 'cmmid_job-1',
						'comment_id'  => 'c-alice',
						'delete_type' => $delete_type,
					)
				)
			);

			$this->assertSame( 403, $response->get_status(), $delete_type );
			$this->assertSame( 'comment_not_owned', $response->get_data()['errorType'], $delete_type );
		}

		$this->assertSame( array(), $this->central_writes() );
	}

	/** An email sent by the browser does not make someone the owner. */
	public function test_delete_ignores_an_email_sent_by_the_browser() {
		$this->sign_in_as( self::BOB, 'Bob' );

		$response = $this->engagement()->user_delete_comment(
			new \WP_REST_Request(
				array(
					'video_id'      => 'cmmid_job-1',
					'comment_id'    => 'c-alice',
					'delete_type'   => 'hard-delete',
					'comment_email' => self::ALICE,
					'author_email'  => self::ALICE,
				)
			)
		);

		$this->assertSame( 403, $response->get_status() );
		$this->assertSame( array(), $this->central_writes() );
	}

	/** A comment id that is not on this video is refused too. */
	public function test_delete_of_an_unknown_comment_is_refused() {
		$this->sign_in_as( self::ALICE, 'Alice' );

		$response = $this->engagement()->user_delete_comment(
			new \WP_REST_Request(
				array(
					'video_id'    => 'cmmid_job-1',
					'comment_id'  => 'c-from-another-video',
					'delete_type' => 'hard-delete',
				)
			)
		);

		$this->assertSame( 403, $response->get_status() );
		$this->assertSame( array(), $this->central_writes() );
	}

	/** The author can delete their comment, and Central hears the signed-in user's email. */
	public function test_owner_can_delete_their_own_comment() {
		$this->sign_in_as( self::ALICE, 'Alice' );

		$response = $this->engagement()->user_delete_comment(
			new \WP_REST_Request(
				array(
					'video_id'    => 'cmmid_job-1',
					'comment_id'  => 'c-alice-2',
					'delete_type' => 'hard-delete',
				)
			)
		);

		$this->assertSame( 200, $response->get_status() );
		$writes = $this->central_writes();
		$this->assertCount( 1, $writes );
		$this->assertStringContainsString( 'delete_comment', $writes[0]['url'] );
		$this->assertSame( 'c-alice-2', $writes[0]['body']['name'] );
		$this->assertSame( self::ALICE, $writes[0]['body']['comment_email'] );
	}

	/** If the comment cannot be checked, nothing is deleted. */
	public function test_delete_is_refused_when_central_cannot_be_reached() {
		$this->sign_in_as( self::ALICE, 'Alice' );
		$GLOBALS['rtgodam_stub']['central_down'] = true;

		$response = $this->engagement()->user_delete_comment(
			new \WP_REST_Request(
				array(
					'video_id'    => 'cmmid_job-1',
					'comment_id'  => 'c-alice',
					'delete_type' => 'hard-delete',
				)
			)
		);

		$this->assertSame( 'error', $response->get_data()['status'] );
		$this->assertSame( array(), $this->central_writes() );
	}

	/** Editing someone else's comment is refused and nothing reaches Central. */
	public function test_edit_of_another_users_comment_is_refused() {
		$this->sign_in_as( self::BOB, 'Bob' );

		$response = $this->engagement()->user_comment(
			new \WP_REST_Request(
				array(
					'video_id'          => 'cmmid_job-1',
					'comment_parent_id' => 'c-alice',
					'comment_text'      => 'Changed by someone else',
					'comment_type'      => 'edit',
				)
			)
		);

		$this->assertSame( 403, $response->get_status() );
		$this->assertSame( array(), $this->central_writes() );
	}

	/** The author can edit their comment. */
	public function test_owner_can_edit_their_own_comment() {
		$this->sign_in_as( self::ALICE, 'Alice' );

		$response = $this->engagement()->user_comment(
			new \WP_REST_Request(
				array(
					'video_id'          => 'cmmid_job-1',
					'comment_parent_id' => 'c-alice',
					'comment_text'      => 'Edited',
					'comment_type'      => 'edit',
				)
			)
		);

		$this->assertSame( 200, $response->get_status() );
		$writes = $this->central_writes();
		$this->assertCount( 1, $writes );
		$this->assertStringContainsString( 'wp_update_comment', $writes[0]['url'] );
		$this->assertSame( 'c-alice', $writes[0]['body']['name'] );
	}

	/** Replying to someone else's comment is allowed, and the reply comes back flagged as the writer's own, without an email. */
	public function test_reply_to_another_users_comment_is_allowed_and_carries_no_email() {
		$this->sign_in_as( self::BOB, 'Bob' );

		$response = $this->engagement()->user_comment(
			new \WP_REST_Request(
				array(
					'video_id'          => 'cmmid_job-1',
					'comment_parent_id' => 'c-alice',
					'comment_text'      => 'A reply',
					'comment_type'      => 'new',
				)
			)
		);

		$data = $response->get_data()['data'];
		$this->assertSame( 200, $response->get_status() );
		$this->assertTrue( $data['is_own'] );
		$this->assertArrayNotHasKey( 'author_email', $data );
		$this->assertStringNotContainsString( '@', wp_json_encode( $data ) );
	}

	/**
	 * The requests the plugin made to read comments from Central.
	 *
	 * @return array List of decoded request bodies.
	 */
	private function central_comment_reads() {
		$reads = array();
		foreach ( $GLOBALS['rtgodam_stub']['posts'] ?? array() as $post ) {
			if ( false !== strpos( $post['url'], 'get_wp_comments' ) ) {
				$reads[] = json_decode( $post['args']['body'], true );
			}
		}
		return $reads;
	}

	/**
	 * Build a long thread: Alice wrote the oldest comment, others wrote the rest.
	 *
	 * @param int $total Number of comments.
	 */
	private function set_long_thread( $total ) {
		$rows = array();
		for ( $i = 1; $i <= $total; $i++ ) {
			$row             = $this->comment_row( 'c-' . $i, self::BOB, 'Bob', null );
			$row['creation'] = gmdate( 'Y-m-d H:i:s', 1790000000 + $i * 60 );
			$rows[]          = $row;
		}
		$rows[0]['comment_email'] = self::ALICE;
		$rows[0]['comment_by']    = 'Alice';
		$this->set_central_comments( $rows );
	}

	/** The author can change a comment that is older than Central's newest 20 (and than the first lookup page). */
	public function test_owner_can_delete_a_comment_beyond_the_newest_comments() {
		$this->set_long_thread( 250 );
		$this->sign_in_as( self::ALICE, 'Alice' );

		$response = $this->engagement()->user_delete_comment(
			new \WP_REST_Request(
				array(
					'video_id'    => 'cmmid_job-1',
					'comment_id'  => 'c-1',
					'delete_type' => 'hard-delete',
				)
			)
		);

		$this->assertSame( 200, $response->get_status() );
		$writes = $this->central_writes();
		$this->assertCount( 1, $writes );
		$this->assertSame( 'c-1', $writes[0]['body']['name'] );
		// Three pages of 100: the comment is the oldest of 250.
		$this->assertSame( array( 0, 100, 200 ), array_column( $this->central_comment_reads(), 'start' ) );
	}

	/** A comment on the first page is found without reading further. */
	public function test_ownership_lookup_stops_once_the_comment_is_found() {
		$this->set_long_thread( 250 );
		$this->sign_in_as( self::BOB, 'Bob' );

		$response = $this->engagement()->user_delete_comment(
			new \WP_REST_Request(
				array(
					'video_id'    => 'cmmid_job-1',
					'comment_id'  => 'c-250',
					'delete_type' => 'hard-delete',
				)
			)
		);

		$this->assertSame( 200, $response->get_status() );
		$this->assertCount( 1, $this->central_comment_reads() );
	}

	/** A comment that is nowhere in the thread is refused after reading it all, and no further. */
	public function test_ownership_lookup_reads_every_page_then_refuses_an_unknown_comment() {
		$this->set_long_thread( 250 );
		$this->sign_in_as( self::ALICE, 'Alice' );

		$response = $this->engagement()->user_delete_comment(
			new \WP_REST_Request(
				array(
					'video_id'    => 'cmmid_job-1',
					'comment_id'  => 'c-999',
					'delete_type' => 'hard-delete',
				)
			)
		);

		$this->assertSame( 403, $response->get_status() );
		$this->assertSame( array( 0, 100, 200 ), array_column( $this->central_comment_reads(), 'start' ) );
		$this->assertSame( array(), $this->central_writes() );
	}

	/** An old comment that is not the viewer's is still refused, wherever it sits. */
	public function test_old_comment_of_another_user_is_refused() {
		$this->set_long_thread( 250 );
		$this->sign_in_as( self::BOB, 'Bob' );

		$response = $this->engagement()->user_delete_comment(
			new \WP_REST_Request(
				array(
					'video_id'    => 'cmmid_job-1',
					'comment_id'  => 'c-1',
					'delete_type' => 'soft-delete',
				)
			)
		);

		$this->assertSame( 403, $response->get_status() );
		$this->assertSame( array(), $this->central_writes() );
	}

	/** A Central that ignores paging cannot keep the lookup reading. */
	public function test_ownership_lookup_ends_when_central_ignores_paging() {
		$this->set_long_thread( 250 );
		$GLOBALS['rtgodam_stub']['central_ignores_paging'] = true;
		$this->sign_in_as( self::ALICE, 'Alice' );

		$response = $this->engagement()->user_delete_comment(
			new \WP_REST_Request(
				array(
					'video_id'    => 'cmmid_job-1',
					'comment_id'  => 'c-1',
					'delete_type' => 'hard-delete',
				)
			)
		);

		$this->assertSame( 403, $response->get_status() );
		$this->assertCount( 1, $this->central_comment_reads() );
	}

	/** The public list still asks Central for its default window, not the whole thread. */
	public function test_the_public_list_does_not_read_past_centrals_default_window() {
		$this->set_long_thread( 250 );

		$response = $this->get_activities();

		$reads = $this->central_comment_reads();
		$this->assertCount( 1, $reads );
		$this->assertArrayNotHasKey( 'limit', $reads[0] );
		$this->assertCount( 20, $response->get_data()['data']['comments'] );
		$this->assertSame( 250, $response->get_data()['data']['comments_count'] );
	}

	/** Only a signed-in WordPress user may reach the write routes. */
	public function test_visitors_who_are_not_signed_in_cannot_write() {
		$this->sign_in_as( null );

		$this->assertFalse( $this->engagement()->engagement_permission_check() );

		$this->sign_in_as( self::ALICE, 'Alice' );

		$this->assertTrue( $this->engagement()->engagement_permission_check() );
	}
}
