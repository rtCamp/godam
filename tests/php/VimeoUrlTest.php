<?php
/**
 * Unit tests for recognising Vimeo video URLs (Vimeo migration, issue #100).
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Vimeo_Migration\Vimeo_Url;

require_once dirname( __DIR__ ) . '/stubs/vimeo-migration-functions.php';

/**
 * @covers \RTGODAM\Inc\Vimeo_Migration\Vimeo_Url
 */
class VimeoUrlTest extends TestCase {

	/**
	 * Vimeo URLs and the video ID each one holds.
	 *
	 * @return array<string, array{0: string, 1: string}>
	 */
	public function vimeo_urls(): array {
		return array(
			'plain'                  => array( 'https://vimeo.com/1126119215', '1126119215' ),
			'share link with query'  => array( 'https://vimeo.com/1126119215?fl=pl&fe=sh', '1126119215' ),
			'www host'               => array( 'https://www.vimeo.com/76979871', '76979871' ),
			'unlisted hash'          => array( 'https://vimeo.com/76979871/8272103f6e', '76979871' ),
			'player embed'           => array( 'https://player.vimeo.com/video/76979871?h=8272103f6e', '76979871' ),
			'protocol relative'      => array( '//player.vimeo.com/video/76979871', '76979871' ),
			'channel'                => array( 'https://vimeo.com/channels/staffpicks/76979871', '76979871' ),
			'group'                  => array( 'https://vimeo.com/groups/shortfilms/videos/76979871', '76979871' ),
			'showcase'               => array( 'https://vimeo.com/showcase/9876543/video/76979871', '76979871' ),
			'album'                  => array( 'https://vimeo.com/album/9876543/video/76979871', '76979871' ),
			'manage'                 => array( 'https://vimeo.com/manage/videos/76979871', '76979871' ),
			'surrounding whitespace' => array( "  https://vimeo.com/76979871\n", '76979871' ),
		);
	}

	/**
	 * @dataProvider vimeo_urls
	 *
	 * @param string $url         Vimeo URL.
	 * @param string $expected_id Video ID it holds.
	 */
	public function test_reads_the_video_id( string $url, string $expected_id ) {
		$this->assertTrue( Vimeo_Url::is_vimeo_url( $url ) );
		$this->assertSame( $expected_id, Vimeo_Url::get_video_id( $url ) );
	}

	/**
	 * Values that are not a link to a single Vimeo video.
	 *
	 * @return array<string, array{0: mixed}>
	 */
	public function not_vimeo_urls(): array {
		return array(
			'other host'              => array( 'https://www.youtube.com/watch?v=XHOmBV4js_E' ),
			'lookalike host'          => array( 'https://notvimeo.com/76979871' ),
			'vimeo host as subdomain' => array( 'https://vimeo.com.example.org/76979871' ),
			'vimeo only in the query' => array( 'https://example.org/?next=https://vimeo.com/76979871' ),
			'vimeo profile, no video' => array( 'https://vimeo.com/someuser' ),
			'vimeo home page'         => array( 'https://vimeo.com/' ),
			'not http'                => array( 'ftp://vimeo.com/76979871' ),
			'empty string'            => array( '' ),
			'not a string'            => array( 76979871 ),
			'url inside text'         => array( 'Watch https://vimeo.com/76979871 now' ),
		);
	}

	/**
	 * @dataProvider not_vimeo_urls
	 *
	 * @param mixed $value Value to check.
	 */
	public function test_rejects_values_that_are_not_a_vimeo_video( $value ) {
		$this->assertFalse( Vimeo_Url::is_vimeo_url( $value ) );
	}
}
