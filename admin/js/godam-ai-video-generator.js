/**
 * GoDAM AI Video Generator
 * 
 * Handles the frontend functionality for AI video generation
 */
(function($) {
    'use strict';

    $(document).ready(function() {
        const $generateBtn = $('#godam-generate-video-btn');
        const $spinner = $('#godam-video-spinner');
        const $result = $('#godam-video-result');
        const $error = $('#godam-video-error');
        const $errorMessage = $('#godam-video-error-message');
        const $videoContent = $('#godam-video-content');

        // Handle generate video button click
        $generateBtn.on('click', function(e) {
            e.preventDefault();
            
            // Reset previous results
            $result.hide();
            $error.hide();
            
            // Get selected images
            const selectedImages = [];
            $('input[name="selected_images[]"]:checked').each(function() {
                selectedImages.push($(this).val());
            });
            
            // Get prompt
            const prompt = $('#godam-video-prompt').val().trim();
            
            // Validate inputs
            if (selectedImages.length === 0) {
                showError(godamAiVideo.strings.selectImages);
                return;
            }
            
            if (prompt === '') {
                showError(godamAiVideo.strings.enterPrompt);
                return;
            }
            
            // Start generation
            startGeneration(selectedImages, prompt);
        });

        /**
         * Start video generation process
         */
        function startGeneration(selectedImages, prompt) {
            // Show loading state
            $generateBtn.prop('disabled', true).text(godamAiVideo.strings.generating);
            $spinner.addClass('is-active');
            
            // Show processing message
            showNotice(godamAiVideo.strings.processingTime, 'info');
            
            // Get product ID
            const productId = $('#post_ID').val();
            
            // Make AJAX request
            $.ajax({
                url: godamAiVideo.ajaxurl,
                type: 'POST',
                data: {
                    action: 'godam_generate_ai_video',
                    nonce: godamAiVideo.nonce,
                    product_id: productId,
                    selected_images: selectedImages,
                    prompt: prompt
                },
                timeout: 300000, // 5 minutes timeout
                success: function(response) {
                    if (response.success) {
                        showSuccess(response.data);
                    } else {
                        showError(response.data || godamAiVideo.strings.error);
                    }
                },
                error: function(xhr, status, error) {
                    let errorMessage = godamAiVideo.strings.error;
                    
                    if (status === 'timeout') {
                        errorMessage = 'Request timed out. Video generation may still be processing.';
                    } else if (xhr.responseJSON && xhr.responseJSON.data) {
                        errorMessage = xhr.responseJSON.data;
                    }
                    
                    showError(errorMessage);
                },
                complete: function() {
                    // Reset loading state
                    $generateBtn.prop('disabled', false).text('Generate AI Video');
                    $spinner.removeClass('is-active');
                }
            });
        }

        /**
         * Show success result
         */
        function showSuccess(data) {
            $error.hide();
            
            let content = '<div class="godam-video-success">';
            content += '<p><strong>' + godamAiVideo.strings.success + '</strong></p>';
            
            if (data.video_url) {
                content += '<video controls>';
                content += '<source src="' + escapeHtml(data.video_url) + '" type="video/mp4">';
                content += 'Your browser does not support the video tag.';
                content += '</video>';
                content += '<p><a href="' + escapeHtml(data.video_url) + '" target="_blank" class="button">Download Video</a></p>';
            }
            
            if (data.task_id) {
                content += '<p><small>Task ID: ' + escapeHtml(data.task_id) + '</small></p>';
            }
            
            content += '</div>';
            
            $videoContent.html(content);
            $result.show();
            
            // Scroll to result
            $result[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        /**
         * Show error message
         */
        function showError(message) {
            $result.hide();
            $errorMessage.text(message);
            $error.show();
            
            // Scroll to error
            $error[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        /**
         * Show notice message
         */
        function showNotice(message, type = 'info') {
            // Remove existing notices
            $('.godam-ai-notice').remove();
            
            const noticeClass = 'notice notice-' + type + ' godam-ai-notice';
            const notice = '<div class="' + noticeClass + '"><p>' + escapeHtml(message) + '</p></div>';
            
            $('#godam-ai-video-generator').prepend(notice);
            
            // Auto-remove after 10 seconds
            setTimeout(function() {
                $('.godam-ai-notice').fadeOut();
            }, 10000);
        }

        /**
         * Escape HTML to prevent XSS
         */
        function escapeHtml(text) {
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return text.replace(/[&<>"']/g, function(m) { return map[m]; });
        }

        // Handle image selection visual feedback
        $(document).on('change', 'input[name="selected_images[]"]', function() {
            const $img = $(this).siblings('img');
            if ($(this).is(':checked')) {
                $img.addClass('selected');
            } else {
                $img.removeClass('selected');
            }
        });
    });

})(jQuery);
