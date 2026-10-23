<?php
/**
 * Unit tests for which videos the Engagement REST routes answer for.
 *
 * Likes, comments and views are shown on public videos, to visitors and signed-in
 * users. The routes turn the video ID the player sends into a GoDAM Central job ID
 * through an attachment of this site, so that a request names a video of this
 * site that the user can see and never a job ID of its own:
 *  - reading answers, and recording a like or a comment, only for such a video;
 *  - for any other video reading gives what a video nobody has engaged with gives,
 *    and nothing is sent to Central or the analytics service;
 *  - a like or a comment on any other video is refused.
 *
 * GoDAM Central is faked through the wp_remote_post() stub (see
 * tests/stubs/engagement-functions.php); the site's videos through
 * rtgodam_stub_video().
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\Engagement;

require_once dirname( __DIR__ ) . '/stubs/post-functions.php';

/**
 * @covers \RTGODAM\Inc\REST_API\Engagement::get_activities
 * @covers \RTGODAM\Inc\REST_API\Engagement::user_hit_like
 * @covers \RTGODAM\Inc\REST_API\Engagement::user_comment
 * @covers \RTGODAM\Inc\REST_API\Engagement::user_delete_comment
 * @covers \RTGODAM\Inc\REST_API\Engagement::get_transcoder_job_id
 * @covers \RTGODAM\Inc\REST_API\Engagement::get_visible_transcoder_job_id
 */
class EngagementVideoScopeTest extends TestCase {

	/**
	 * A public video of this site.
	 */
	const PUBLIC_VIDEO = 41;

	/**
	 * A video attached to a private post: not public, readable by some users.
	 */
	const PRIVATE_VIDEO = 42;

	/**
	 * A video that was never transcoded, so it has no job.
	 */
	const NO_JOB_VIDEO = 43;

	/**
	 * A page, which has an ID like a video but is not an attachment.
	 */
	const PAGE = 44;

	/**
	 * The address of the comment author in the Central fake.
	 */
	const COMMENTER = 'commenter@example.com';

	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_hooks'] = array();
		$GLOBALS['rtgodam_stub']  = array(
			'home_url'     => 'https://www.example.com',
			'options'      => array(
				'rtgodam-account-token' => 'verified-account',
				'rtgodam-api-key'       => 'test-key',
			),
			// The views call the analytics service answers.
			'http'         => array(
				'code' => 200,
				'body' => wp_json_encode( array( 'processed_analytics' => array( 'post_views' => array( 3, 4 ) ) ) ),
			),
			'post_handler' => array( $this, 'central' ),
		);

		rtgodam_stub_video( self::PUBLIC_VIDEO, 'job-public' );
		rtgodam_stub_video( self::PRIVATE_VIDEO, 'job-private', 'private' );
		rtgodam_stub_video( self::NO_JOB_VIDEO, '' );
		rtgodam_stub_video( self::PAGE, '', 'publish', 'page' );
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'], $GLOBALS['rtgodam_hooks'] );
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
	 * Sign in as a user who may read the given attachments though they are not public.
	 *
	 * @param int[] $readable Attachment IDs the user may read.
	 */
	private function sign_in_as( array $readable = array() ) {
		$GLOBALS['rtgodam_stub']['user']        = array(
			'email' => self::COMMENTER,
			'name'  => 'Commenter',
		);
		$GLOBALS['rtgodam_stub']['object_caps'] = array_map(
			static function ( $id ) {
				return 'read_post:' . $id;
			},
			$readable
		);
	}

	/**
	 * Fake GoDAM Central: every job has one comment by the commenter, three likes,
	 * and accepts writes.
	 *
	 * @param string $url  Endpoint URL.
	 * @param array  $args Request args.
	 * @return array
	 */
	public function central( $url, $args ) {
		$body = json_decode( $args['body'], true );
		$job  = $body['name'] ?? ( $body['reference_name'] ?? '' );

		if ( false !== strpos( $url, 'get_wp_comments' ) ) {
			$message = array(
				'comments' => array(
					array(
						'name'            => 'c-' . $job,
						'creation'        => '2026-09-01 10:00:00',
						'content'         => '<p>Comment on ' . $job . '</p>',
						'comment_by'      => 'Commenter',
						'comment_email'   => self::COMMENTER,
						'custom_reply_to' => null,
					),
				),
				'count'    => 1,
			);
		} elseif ( false !== strpos( $url, 'get_wp_likes' ) ) {
			$message = array(
				'status'            => 'success',
				'likes'             => 3,
				'has_liked_by_user' => false,
			);
		} else {
			$message = array(
				'status' => 'success',
				'data'   => array(
					'name'            => 'c-new',
					'creation'        => '2026-09-01 10:00:00',
					'content'         => '<p>hello</p>',
					'comment_by'      => 'Commenter',
					'comment_email'   => self::COMMENTER,
					'custom_reply_to' => null,
				),
			);
		}

		return array(
			'code' => 200,
			'body' => wp_json_encode( array( 'message' => $message ) ),
		);
	}

	/**
	 * Job IDs of the calls the plugin made to Central, in order.
	 *
	 * @param string $endpoint Part of the Central method name, e.g. 'wp_like'.
	 * @return string[]
	 */
	private function central_jobs( $endpoint ) {
		$jobs = array();
		foreach ( $GLOBALS['rtgodam_stub']['posts'] ?? array() as $post ) {
			if ( false !== strpos( $post['url'], $endpoint ) ) {
				$body   = json_decode( $post['args']['body'], true );
				$jobs[] = $body['name'] ?? $body['reference_name'];
			}
		}
		return $jobs;
	}

	/**
	 * Whether the plugin called Central or the analytics service at all.
	 *
	 * @return bool
	 */
	private function asked_anyone() {
		return isset( $GLOBALS['rtgodam_stub']['posts'] ) || isset( $GLOBALS['rtgodam_stub']['last_remote_url'] );
	}

	/**
	 * Run GET /engagement/activities.
	 *
	 * @param int|string $video_id Video ID as the player sends it.
	 * @return \WP_REST_Response
	 */
	private function get_activities( $video_id ) {
		return $this->engagement()->get_activities(
			new \WP_REST_Request(
				array(
					'video_id' => (string) $video_id,
					'site_url' => 'https://www.example.com',
				)
			)
		);
	}

	/**
	 * Run POST /engagement/user-hit-like.
	 *
	 * @param int|string $video_id Video ID as the player sends it.
	 * @return \WP_REST_Response
	 */
	private function hit_like( $video_id ) {
		return $this->engagement()->user_hit_like(
			new \WP_REST_Request(
				array(
					'video_id'    => (string) $video_id,
					'site_url'    => 'https://www.example.com',
					'like_status' => true,
				)
			)
		);
	}

	/**
	 * Run POST /engagement/user-comment for a new comment.
	 *
	 * @param int|string $video_id Video ID as the player sends it.
	 * @return \WP_REST_Response
	 */
	private function comment( $video_id ) {
		return $this->engagement()->user_comment(
			new \WP_REST_Request(
				array(
					'video_id'          => (string) $video_id,
					'site_url'          => 'https://www.example.com',
					'comment_parent_id' => '',
					'comment_text'      => 'hello',
					'comment_type'      => 'new',
				)
			)
		);
	}

	/**
	 * What reading gives for a video nobody has engaged with.
	 *
	 * @return array
	 */
	private function no_engagement() {
		return array(
			'status' => 'success',
			'data'   => array(
				'is_liked'       => false,
				'likes_count'    => 0,
				'comments'       => array(),
				'comments_count' => 0,
			),
		);
	}

	/**
	 * Video IDs that are not a video of this site, or that the visitor cannot see.
	 *
	 * @return array<string, array{0: string}>
	 */
	public function videos_the_visitor_cannot_use() {
		return array(
			'job of another site'        => array( 'cmmid_job-elsewhere' ),
			'attachment ID with no post' => array( '999' ),
			'ID of a page'               => array( (string) self::PAGE ),
			'private video by ID'        => array( (string) self::PRIVATE_VIDEO ),
			'private video by job'       => array( 'cmmid_job-private' ),
			'video without a job'        => array( (string) self::NO_JOB_VIDEO ),
			'zero'                       => array( '0' ),
			'negative ID'                => array( '-41' ),
			'ID with trailing text'      => array( '41abc' ),
			'ID with a space'            => array( ' 41' ),
			'prefix with no job'         => array( 'cmmid_' ),
			'something else'             => array( 'abc' ),
		);
	}

	/** A visitor reads a public video by its attachment ID. */
	public function test_public_video_is_answered_by_attachment_id() {
		$response = $this->get_activities( self::PUBLIC_VIDEO );
		$data     = $response->get_data()['data'];

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 3, $data['likes_count'] );
		$this->assertSame( 1, $data['comments_count'] );
		$this->assertSame( 'Comment on job-public', $data['comments'][0]['text'] );
		$this->assertSame( array( 'job-public' ), array_unique( $this->central_jobs( 'get_wp_' ) ) );
		$this->assertSame( 7, $data['views_count'] );
		$this->assertStringContainsString( 'video_id=41', $GLOBALS['rtgodam_stub']['last_remote_url'] );
	}

	/** Central media the player names by job ID is answered through the attachment that carries the job. */
	public function test_public_video_is_answered_by_job_id_of_its_attachment() {
		$response = $this->get_activities( 'cmmid_job-public' );
		$data     = $response->get_data()['data'];

		$this->assertSame( 3, $data['likes_count'] );
		$this->assertSame( 'Comment on job-public', $data['comments'][0]['text'] );
		$this->assertSame( array( 'job-public' ), array_unique( $this->central_jobs( 'get_wp_' ) ) );

		// The lookup is by this site's attachments, on the job ID or the GoDAM ID.
		$query = $GLOBALS['rtgodam_stub']['get_posts_args'][0];
		$this->assertSame( 'attachment', $query['post_type'] );
		$this->assertSame(
			array( 'rtgodam_transcoding_job_id', '_godam_original_id' ),
			array_column( array_filter( $query['meta_query'], 'is_array' ), 'key' )
		);
		$this->assertSame( array( 'job-public', 'job-public' ), array_column( array_filter( $query['meta_query'], 'is_array' ), 'value' ) );
	}

	/**
	 * @dataProvider videos_the_visitor_cannot_use
	 *
	 * @param string $video_id Video ID as the player sends it.
	 */
	public function test_visitor_gets_no_engagement_and_nothing_is_asked_for_another_video( $video_id ) {
		$response = $this->get_activities( $video_id );

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( $this->no_engagement(), $response->get_data() );
		$this->assertFalse( $this->asked_anyone(), 'neither Central nor the analytics service should be asked' );
	}

	/** The answer for another video has the fields the player reads, so one such video cannot break the page's other videos. */
	public function test_answer_for_another_video_has_the_fields_the_player_reads() {
		$answer = $this->get_activities( 'cmmid_job-elsewhere' )->get_data()['data'];

		foreach ( array( 'is_liked', 'likes_count', 'comments', 'comments_count' ) as $field ) {
			$this->assertArrayHasKey( $field, $answer );
		}
	}

	/** A signed-in user who cannot read a private video gets the same as a visitor. */
	public function test_user_who_cannot_read_a_private_video_gets_no_engagement() {
		$this->sign_in_as( array( self::PUBLIC_VIDEO ) );

		$this->assertSame( $this->no_engagement(), $this->get_activities( self::PRIVATE_VIDEO )->get_data() );
		$this->assertSame( $this->no_engagement(), $this->get_activities( 'cmmid_job-private' )->get_data() );
		$this->assertFalse( $this->asked_anyone() );
	}

	/** A signed-in user who may read a private video sees its engagement, by ID and by job. */
	public function test_user_who_can_read_a_private_video_gets_its_engagement() {
		$this->sign_in_as( array( self::PRIVATE_VIDEO ) );

		$by_id = $this->get_activities( self::PRIVATE_VIDEO )->get_data()['data'];
		$this->assertSame( 3, $by_id['likes_count'] );
		$this->assertSame( 'Comment on job-private', $by_id['comments'][0]['text'] );

		$by_job = $this->get_activities( 'cmmid_job-private' )->get_data()['data'];
		$this->assertSame( 'Comment on job-private', $by_job['comments'][0]['text'] );
	}

	/** Without a key the route still says so, for a video the visitor can see. */
	public function test_missing_key_is_still_reported_for_a_visible_video() {
		$GLOBALS['rtgodam_stub']['options']['rtgodam-api-key'] = '';

		$response = $this->get_activities( self::PUBLIC_VIDEO );

		$this->assertSame( 404, $response->get_status() );
		$this->assertSame( 'missing_key', $response->get_data()['errorType'] );
	}

	/** A like is recorded against the job of the attachment, found from either form of the video ID. */
	public function test_like_is_recorded_for_a_public_video() {
		$this->sign_in_as();

		foreach ( array( (string) self::PUBLIC_VIDEO, 'cmmid_job-public' ) as $video_id ) {
			$response = $this->hit_like( $video_id );

			$this->assertSame( 200, $response->get_status(), $video_id );
			$this->assertSame( 'success', $response->get_data()['status'], $video_id );
		}

		$this->assertSame( array( 'job-public', 'job-public' ), $this->central_jobs( 'wp_like' ) );
	}

	/** A comment is recorded against the job of the attachment, found from either form of the video ID. */
	public function test_comment_is_recorded_for_a_public_video() {
		$this->sign_in_as();

		foreach ( array( (string) self::PUBLIC_VIDEO, 'cmmid_job-public' ) as $video_id ) {
			$response = $this->comment( $video_id );

			$this->assertSame( 200, $response->get_status(), $video_id );
			$this->assertSame( 'success', $response->get_data()['status'], $video_id );
		}

		$this->assertSame( array( 'job-public', 'job-public' ), $this->central_jobs( 'wp_comment' ) );
	}

	/**
	 * @dataProvider videos_the_visitor_cannot_use
	 *
	 * @param string $video_id Video ID as the player sends it.
	 */
	public function test_like_and_comment_are_refused_and_not_sent_for_another_video( $video_id ) {
		$this->sign_in_as( array( self::PUBLIC_VIDEO ) );

		foreach ( array( $this->hit_like( $video_id ), $this->comment( $video_id ) ) as $response ) {
			$this->assertSame( 403, $response->get_status() );
			$this->assertSame( 'error', $response->get_data()['status'] );
			$this->assertSame( 'video_not_available', $response->get_data()['errorType'] );
		}

		$this->assertFalse( $this->asked_anyone(), 'nothing should reach Central' );
	}

	/** A user who may read a private video can like and comment on it. */
	public function test_user_who_can_read_a_private_video_can_like_and_comment() {
		$this->sign_in_as( array( self::PRIVATE_VIDEO ) );

		$this->assertSame( 'success', $this->hit_like( self::PRIVATE_VIDEO )->get_data()['status'] );
		$this->assertSame( 'success', $this->comment( 'cmmid_job-private' )->get_data()['status'] );

		$this->assertSame( array( 'job-private' ), $this->central_jobs( 'wp_like' ) );
		$this->assertSame( array( 'job-private' ), $this->central_jobs( 'wp_comment' ) );
	}

	/** Editing a comment goes through the same check as writing one. */
	public function test_editing_a_comment_on_another_video_is_refused() {
		$this->sign_in_as();

		$response = $this->engagement()->user_comment(
			new \WP_REST_Request(
				array(
					'video_id'          => 'cmmid_job-elsewhere',
					'site_url'          => 'https://www.example.com',
					'comment_parent_id' => 'c-job-elsewhere',
					'comment_text'      => 'edited',
					'comment_type'      => 'edit',
				)
			)
		);

		$this->assertSame( 403, $response->get_status() );
		$this->assertSame( 'video_not_available', $response->get_data()['errorType'] );
		$this->assertFalse( $this->asked_anyone() );
	}

	/** The commenter can still delete their own comment on a video of this site, however the video is named. */
	public function test_own_comment_on_a_video_of_this_site_can_be_deleted() {
		$this->sign_in_as();

		foreach ( array( (string) self::PUBLIC_VIDEO, 'cmmid_job-public' ) as $video_id ) {
			$response = $this->engagement()->user_delete_comment(
				new \WP_REST_Request(
					array(
						'video_id'    => $video_id,
						'comment_id'  => 'c-job-public',
						'delete_type' => 'soft-delete',
					)
				)
			);

			$this->assertSame( 200, $response->get_status(), $video_id );
		}
	}

	/** A job ID that is not on this site is never sent to Central, not even to look for a comment. */
	public function test_delete_does_not_use_a_job_id_of_another_site() {
		$this->sign_in_as();

		$response = $this->engagement()->user_delete_comment(
			new \WP_REST_Request(
				array(
					'video_id'    => 'cmmid_job-elsewhere',
					'comment_id'  => 'c-job-elsewhere',
					'delete_type' => 'hard-delete',
				)
			)
		);

		$this->assertSame( 403, $response->get_status() );
		$this->assertSame( 'comment_not_owned', $response->get_data()['errorType'] );
		$this->assertFalse( $this->asked_anyone() );
	}

	/** The job ID comes from the attachment, never from the request. */
	public function test_job_id_is_only_found_through_an_attachment_of_this_site() {
		$engagement = $this->engagement();

		$this->assertSame( 'job-public', $engagement->get_transcoder_job_id( (string) self::PUBLIC_VIDEO ) );
		$this->assertSame( 'job-public', $engagement->get_transcoder_job_id( 'cmmid_job-public' ) );
		$this->assertSame( 'job-private', $engagement->get_transcoder_job_id( (string) self::PRIVATE_VIDEO ) );
		$this->assertNull( $engagement->get_transcoder_job_id( 'cmmid_job-elsewhere' ) );
		$this->assertNull( $engagement->get_transcoder_job_id( (string) self::PAGE ) );
		$this->assertNull( $engagement->get_transcoder_job_id( 'abc' ) );
	}

	/** Visibility is the current user's: the same video is visible to one user and not to another. */
	public function test_visibility_follows_the_current_user() {
		$engagement = $this->engagement();

		$this->assertNull( $engagement->get_visible_transcoder_job_id( (string) self::PRIVATE_VIDEO ), 'visitor' );

		$this->sign_in_as( array( self::PRIVATE_VIDEO ) );
		$this->assertSame( 'job-private', $engagement->get_visible_transcoder_job_id( (string) self::PRIVATE_VIDEO ), 'user who can read it' );

		$this->sign_in_as( array( self::PUBLIC_VIDEO ) );
		$this->assertNull( $engagement->get_visible_transcoder_job_id( (string) self::PRIVATE_VIDEO ), 'user who cannot' );
		$this->assertSame( 'job-public', $engagement->get_visible_transcoder_job_id( (string) self::PUBLIC_VIDEO ), 'public video' );
	}

	/** Every attachment lookup is bracketed for integrations that keep media on another site, and the pair stays balanced. */
	public function test_attachment_lookup_is_bracketed_whatever_the_outcome() {
		$calls = array();
		add_action(
			'rtgodam_before_attachment_lookup',
			static function () use ( &$calls ) {
				$calls[] = 'before';
			}
		);
		add_action(
			'rtgodam_after_attachment_lookup',
			static function () use ( &$calls ) {
				$calls[] = 'after';
			}
		);

		foreach ( array( (string) self::PUBLIC_VIDEO, 'cmmid_job-public', 'cmmid_job-elsewhere', (string) self::PAGE, '999', 'abc' ) as $video_id ) {
			$calls = array();
			$this->engagement()->get_visible_transcoder_job_id( $video_id );

			$this->assertSame( array( 'before', 'after' ), $calls, $video_id );
		}
	}
}
