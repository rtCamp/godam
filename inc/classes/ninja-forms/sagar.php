<?php

add_filter( 'show_admin_bar' , '__return_false' );

$form_id = get_query_var( 'rtgodam-form-id' );

wp_head();
?>
<style>
    html {
        margin: 0;
        padding: 0;
    }

    body {
        background: unset;
        margin: 0;
        padding: 0;
        width: 100%;
    }

    body #primary {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    body #primary .nf-form-cont {
        width: 100%;
        height: 100%;
    }
</style>


<body <?php body_class(); ?>>
    <main id="primary" role="main">
<?php echo do_shortcode("[ninja_form id='{$form_id}']"); ?>
    </main>
</body>
<?php
wp_footer();
