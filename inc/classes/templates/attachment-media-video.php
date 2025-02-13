<?php
// Get dynamic attachment data.
$attachment_id = $args['post_id'];
$src           = wp_get_attachment_url( $attachment_id );
?>

<!-- wp:group {"align":"full","layout":{"type":"default"}} -->
<div class="wp-block-group alignfull">
    <!-- wp:columns {"className":"is-style-default","style":{"spacing":{"padding":{"right":"0","left":"0"},"blockGap":{"left":"0"}},"border":{"width":"1px"}}} -->
    <div class="wp-block-columns is-style-default" style="border-width:1px;padding-right:0;padding-left:0">
        <!-- wp:column {"width":"66.66%","style":{"spacing":{"padding":{"right":"0","left":"0","top":"0","bottom":"0"}}}} -->
        <div class="wp-block-column" style="padding-top:0;padding-right:0;padding-bottom:0;padding-left:0;flex-basis:66.66%">
            <!-- wp:group {"style":{"spacing":{"padding":{"right":"var:preset|spacing|40","left":"var:preset|spacing|40","bottom":"var:preset|spacing|40"},"margin:{"top":"var:preset|spacing|40}}},"layout":{"type":"default"}} -->
            <div class="wp-block-group" style="padding-right:var(--wp--preset--spacing--40);padding-bottom:var(--wp--preset--spacing--40);padding-left:var(--wp--preset--spacing--40);margin-top:var(--wp--preset--spacing--20);">
                
                <!-- wp:post-title {"style":{"typography":{"fontStyle":"normal","fontWeight":"500"},"spacing":{"padding":{"top":"0","bottom":"0","left":"0","right":"0"}}},"fontSize":"large"} /-->
                <!-- wp:group {"style":{"border":{"width":"1px"}},"layout":{"type":"default"}} -->
                <div class="wp-block-group">
                    <!-- wp:godam/video {"id":<?php echo intval( $attachment_id ); ?> } /-->
                </div>
                <!-- /wp:group -->

            </div>
            <!-- /wp:group -->
        </div>
        <!-- /wp:column -->

        <!-- wp:column {"width":"33.33%","className":"is-style-section-1","style":{"spacing":{"padding":{"right":"0","left":"0"}},"border":{"left":{"width":"1px"},"radius":"0rem"},"color":{"background":"#ffffff"}}} -->
        <div class="wp-block-column is-style-section-1 has-background" style="border-radius:0rem;border-left-width:1px;background-color:#ffffff;padding-right:0;padding-left:0;flex-basis:33.33%">
            <!-- wp:comments {"style":{"spacing":{"padding":{"right":"var:preset|spacing|30","left":"var:preset|spacing|30"}}}} -->
            <div class="wp-block-comments" style="padding-right:var(--wp--preset--spacing--30);padding-left:var(--wp--preset--spacing--30)">
                <!-- wp:group {"className":"comment-header","style":{"spacing":{"padding":{"right":"0","left":"0"}}},"layout":{"type":"default"}} -->
                <div class="wp-block-group comment-header">
                    <!-- wp:paragraph {"style":{"typography":{"fontStyle":"normal","fontWeight":"600"},"spacing":{"margin":{"top":"var:preset|spacing|20","bottom":"0"}}},"fontSize":"medium"} -->
                    <p class="has-medium-font-size" style="margin-top:var(--wp--preset--spacing--20);margin-bottom:0;font-style:normal;font-weight:600">Comments</p>
                    <!-- /wp:paragraph -->

                    <!-- wp:post-comments-form {"style":{"spacing":{"padding":{"top":"0","bottom":"0"}}},"fontSize":"medium"} /-->

                    <!-- wp:comments-title {"showPostTitle":false,"style":{"typography":{"fontStyle":"normal","fontWeight":"500"}},"fontSize":"medium"} /-->
                </div>
                <!-- /wp:group -->

                <!-- wp:comment-template {"style":{"spacing":{"margin":{"left":"0","right":"0","top":"0px","bottom":"0px"},"padding":{"top":"0","bottom":"0"}}},"fontSize":"small"} -->
                <!-- wp:columns {"style":{"spacing":{"blockGap":{"left":"var:preset|spacing|20"},"padding":{"top":"var:preset|spacing|20","bottom":"var:preset|spacing|20","left":"var:preset|spacing|20","right":"var:preset|spacing|20"}},"border":{"radius":"0.5rem"},"color":{"background":"#f2f2f2"}}} -->
                <div class="wp-block-columns has-background" style="border-radius:0.5rem;background-color:#f2f2f2;padding-top:var(--wp--preset--spacing--20);padding-right:var(--wp--preset--spacing--20);padding-bottom:var(--wp--preset--spacing--20);padding-left:var(--wp--preset--spacing--20)">

                    <!-- wp:column {"width":"24px"} -->
                    <div class="wp-block-column" style="flex-basis:24px">
                        <!-- wp:avatar {"size":24,"style":{"border":{"radius":"20px"}}} /-->
                    </div>
                    <!-- /wp:column -->

                    <!-- wp:column {"style":{"spacing":{"blockGap":"0px"}}} -->
                    <div class="wp-block-column">

                        <!-- wp:group {"style":{"spacing":{"margin":{"top":"0px","bottom":"0px"},"padding":{"top":"0","bottom":"0"}}},"layout":{"type":"flex"}} -->
                        <div class="wp-block-group" style="margin-top:0px;margin-bottom:0px;padding-top:0;padding-bottom:0">
                            <!-- wp:comment-author-name {"fontSize":"small"} /-->

                            <!-- wp:comment-date {"format":"human-diff","fontSize":"small"} /-->

                            <!-- wp:comment-edit-link {"style":{"layout":{"selfStretch":"fit","flexSize":null}},"fontSize":"small"} /-->
                        </div>
                        <!-- /wp:group -->

                        <!-- wp:comment-content /-->

                        <!-- wp:comment-reply-link {"fontSize":"small"} /-->
                    </div>
                    <!-- /wp:column -->

                </div>
                <!-- /wp:columns -->
                <!-- /wp:comment-template -->

                <!-- wp:comments-pagination {"layout":{"type":"flex","flexWrap":"wrap"}} -->
                <!-- wp:comments-pagination-previous /-->

                <!-- wp:comments-pagination-numbers /-->

                <!-- wp:comments-pagination-next /-->
                <!-- /wp:comments-pagination -->
            </div>
            <!-- /wp:comments -->
        </div>
        <!-- /wp:column -->
    </div>
    <!-- /wp:columns -->
</div>
<!-- /wp:group -->