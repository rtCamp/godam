<?php

add_filter( 'show_admin_bar' , '__return_false' );



$form_id = get_query_var( 'rtgodam-form-id' );

wp_head();
?>
<style>
    body {
        background: unset;
        margin-right: 5%;
    }
</style>



<?php

echo do_shortcode("[ninja_form id='{$form_id}']");


wp_footer();
