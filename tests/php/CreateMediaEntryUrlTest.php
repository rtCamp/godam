<?php
/**
 * The create-media-entry route saves only public http(s) media and stream URLs.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;

/**
 * Each test runs in its own process: the file stubs and the route class load here.
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class CreateMediaEntryUrlTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();

		require_once __DIR__ . '/../stubs/media-file-functions.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/rest-api/class-media-library.php';

		$GLOBALS['rtgodam_stub'] = array( 'new_attachment_id' => 99 );
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'] );
		parent::tearDown();
	}

	/**
	 * Call the create-media-entry handler with a JSON body.
	 *
	 * @param array $overrides Request fields that replace the defaults.
	 * @return mixed The handler's return value.
	 */
	private function create_media_entry( array $overrides = array() ) {
		$body = array_merge(
			array(
				'id'       => 'job-abc',
				'title'    => 'Clip',
				'mime'     => 'video/mp4',
				'type'     => 'video',
				'filename' => 'clip.mp4',
				'url'      => 'https://abc.cdn.example.test/job-abc/clip.mp4',
				'mpd_url'  => 'https://abc.cdn.example.test/job-abc/manifest.mpd',
				'hls_url'  => 'https://abc.cdn.example.test/job-abc/index.m3u8',
			),
			$overrides
		);

		$request = new class( $body ) {

			/** @var array */
			private $body;

			/** @param array $body JSON body. */
			public function __construct( array $body ) {
				$this->body = $body;
			}

			/** @return array */
			public function get_json_params() {
				return $this->body;
			}
		};

		$media_library = ( new \ReflectionClass( \RTGODAM\Inc\REST_API\Media_Library::class ) )->newInstanceWithoutConstructor();

		return $media_library->create_media_entry( $request );
	}

	public function test_a_normal_cdn_style_entry_is_saved_with_its_urls(): void {
		$response = $this->create_media_entry();

		$this->assertInstanceOf( \WP_REST_Response::class, $response );
		$this->assertSame( 200, $response->get_status() );

		$this->assertSame( 'https://abc.cdn.example.test/job-abc/clip.mp4', $GLOBALS['rtgodam_stub']['inserted_attachment']['guid'] );
		$this->assertSame( 'https://abc.cdn.example.test/job-abc/manifest.mpd', $GLOBALS['rtgodam_stub']['meta_writes']['rtgodam_transcoded_url'] );
		$this->assertSame( 'https://abc.cdn.example.test/job-abc/index.m3u8', $GLOBALS['rtgodam_stub']['meta_writes']['rtgodam_hls_transcoded_url'] );
	}

	public function test_entries_without_stream_urls_are_still_saved(): void {
		foreach ( array( '', null ) as $empty ) {
			$GLOBALS['rtgodam_stub'] = array( 'new_attachment_id' => 99 );

			$response = $this->create_media_entry(
				array(
					'mpd_url' => $empty,
					'hls_url' => $empty,
				)
			);

			$this->assertSame( 200, $response->get_status() );
			$this->assertSame( '', $GLOBALS['rtgodam_stub']['meta_writes']['rtgodam_transcoded_url'] );
		}
	}

	public function test_audio_and_image_entries_on_the_cdn_are_saved(): void {
		$response = $this->create_media_entry(
			array(
				'mime'    => 'audio/mpeg',
				'type'    => 'audio',
				'url'     => 'https://abc.cdn.example.test/job-abc/voice.mp3?token=1',
				'mpd_url' => 'https://abc.cdn.example.test/job-abc/voice.mp3?token=1',
				'hls_url' => '',
			)
		);

		$this->assertSame( 200, $response->get_status() );
	}

	/**
	 * @return array<string, array{string, mixed}>
	 */
	public function refused_url_provider(): array {
		return array(
			'loopback'                  => array( 'url', 'http://127.0.0.1/clip.mp4' ),
			'loopback range'            => array( 'url', 'http://127.1.2.3/clip.mp4' ),
			'cloud metadata'            => array( 'url', 'http://169.254.169.254/latest/meta-data/' ),
			'cloud metadata over https' => array( 'url', 'https://169.254.169.254/latest/meta-data/' ),
			'private 10.x'              => array( 'url', 'http://10.0.0.5/clip.mp4' ),
			'private 172.16.x'          => array( 'url', 'http://172.16.0.5/clip.mp4' ),
			'private 192.168.x'         => array( 'url', 'http://192.168.1.5/clip.mp4' ),
			'unspecified address'       => array( 'url', 'http://0.0.0.0/clip.mp4' ),
			'file scheme'               => array( 'url', 'file:///etc/passwd' ),
			'ftp scheme'                => array( 'url', 'ftp://cdn.example.test/clip.mp4' ),
			'script scheme'             => array( 'url', 'javascript:alert(1)' ),
			'credentials in the url'    => array( 'url', 'https://user:pass@cdn.example.test/clip.mp4' ),
			'unusual port'              => array( 'url', 'http://cdn.example.test:6379/clip.mp4' ),
			'no host'                   => array( 'url', '/clip.mp4' ),
			'not a string'              => array( 'url', array( 'https://cdn.example.test/clip.mp4' ) ),
			'loopback mpd'              => array( 'mpd_url', 'http://127.0.0.1/manifest.mpd' ),
			'metadata mpd'              => array( 'mpd_url', 'http://169.254.169.254/manifest.mpd' ),
			'private mpd'               => array( 'mpd_url', 'http://10.0.0.5/manifest.mpd' ),
			'loopback hls'              => array( 'hls_url', 'http://127.0.0.1/index.m3u8' ),
			'metadata hls'              => array( 'hls_url', 'http://169.254.169.254/index.m3u8' ),
			'file hls'                  => array( 'hls_url', 'file:///etc/passwd' ),
		);
	}

	/**
	 * @dataProvider refused_url_provider
	 *
	 * @param string $field Request field that carries the URL.
	 * @param mixed  $value The URL.
	 */
	public function test_an_entry_with_a_refused_url_is_rejected_and_nothing_is_saved( $field, $value ): void {
		$response = $this->create_media_entry( array( $field => $value ) );

		$this->assertInstanceOf( \WP_Error::class, $response );
		$this->assertSame( 'invalid_url', $response->get_error_code() );
		$this->assertSame( array( 'status' => 400 ), $response->get_error_data() );
		$this->assertArrayNotHasKey( 'inserted_attachment', $GLOBALS['rtgodam_stub'], 'No attachment is created.' );
		$this->assertArrayNotHasKey( 'meta_writes', $GLOBALS['rtgodam_stub'], 'No meta is written.' );
	}
}
