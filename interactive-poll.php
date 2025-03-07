<?php
/**
 * Plugin Name:       Interactive Poll
 * Description:       Block plugin for adding interactive poll to any posts with block editor feature.
 * Version:           0.1.0
 * Requires at least: 6.7
 * Requires PHP:      7.4
 * Author:            The WordPress Contributors
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       interactive-poll
 *
 * @package CreateBlock
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

/**
 * Registers the block using the metadata loaded from the `block.json` file.
 * Behind the scenes, it registers also all assets so they can be enqueued
 * through the block editor in the corresponding context.
 *
 * @see https://developer.wordpress.org/reference/functions/register_block_type/
 */
function create_block_interactive_poll_block_init() {
	register_block_type( __DIR__ . '/build/interactive-poll',
		['render_callback' => 'interactive_poll_render_callback']
	);
}
add_action( 'init', 'create_block_interactive_poll_block_init' );

// Render callback function
function interactive_poll_render_callback($attributes) {
	$post_id = get_the_ID();
	return sprintf(
		'<div class="wp-block-custom-interactive-poll" data-post-id="%d" data-attributes="%s"></div>',
		absint($post_id),
		esc_attr(wp_json_encode($attributes))
	);
}

//Custom API routes to handle fetch and vote requests from the front end component
add_action('rest_api_init', function() {
	register_rest_route('interactive-poll/v1', '/vote', [
		'methods' => 'POST',
		'callback' => 'interactive_poll_handle_vote',
		'permission_callback' => '__return_true'
	]);

	register_rest_route('interactive-poll/v1', '/results', [
		'methods' => 'GET',
		'callback' => 'interactive_poll_get_results',
		'permission_callback' => '__return_true'
	]);
});

//Handle vote post data from the front end.
function interactive_poll_handle_vote(WP_REST_Request $request) {
	$params = $request->get_params();

	//check if the poll has expired to avoid voting.
	$blocks = parse_blocks(get_post($params['post_id'])->post_content);
	$poll_block = find_poll_block($blocks, $params['poll_id']);

	if ($poll_block && !empty($poll_block['attrs']['expiration'])) {
		$expiration = strtotime($poll_block['attrs']['expiration']);
		if (time() > $expiration) {
			return new WP_Error(
				'poll_expired',
				'This poll has closed',
				['status' => 403]
			);
		}
	}

	$option_index = absint($params['option_index']);

	//get existing vote data
	$votes = get_post_meta($params['post_id'], "poll_{$params['poll_id']}_votes", true);
	$votes = is_array($votes) ? $votes : [];

	if (!isset($votes[$option_index])) {
		$votes[$option_index] = 0;
	}

	$votes[$option_index] = absint($votes[$option_index]) + 1;

	update_post_meta($params['post_id'], "poll_{$params['poll_id']}_votes", $votes);

	return new WP_REST_Response(['success' => true]);
}

//Handle fetch request from the frontend
function interactive_poll_get_results(WP_REST_Request $request) {
	$votes = get_post_meta($request['post_id'], "poll_{$request['poll_id']}_votes", true);

	if (!is_array($votes)) {
		$votes = [];
	}

	$votes = array_map(function($count) {
		return absint($count);
	}, $votes);

	return new WP_REST_Response(['votes' => $votes]);
}


//function to locate interactive poll block
function find_poll_block($blocks, $poll_id) {
	foreach ($blocks as $block) {
		if ($block['blockName'] === 'interactive-poll/poll' &&
		    $block['attrs']['pollId'] === $poll_id) {
			return $block;
		}
		if (!empty($block['innerBlocks'])) {
			$found = find_poll_block($block['innerBlocks'], $poll_id);
			if ($found) return $found;
		}
	}
	return null;
}
