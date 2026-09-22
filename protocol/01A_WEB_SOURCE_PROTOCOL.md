# Web Source Protocol

## Purpose

Public webpages, articles, blog posts, documentation pages, and direct research URLs are first class source inputs.

A fetched page MUST remain an identifiable source. The system MUST NOT flatten web material into anonymous context.

## Registration

Each fetched page MUST store:

* source id
* requested URL
* final fetched URL
* canonical URL when declared by the page
* page title
* retrieval timestamp
* source role
* extraction status
* extracted readable text
* content type

## Retrieval Safety

The fetch layer MUST reject:

* localhost
* loopback addresses
* private network addresses
* link local addresses
* authenticated URLs containing usernames or passwords
* non HTTP protocols

Redirect targets MUST remain subject to the same public network rule.

## Extraction

Prefer the main article or main content region when available.

Remove scripts, styles, navigation, forms, decorative controls, and other material that does not belong to the research text.

Preserve headings, paragraphs, lists, quotations, tables, and code blocks when they carry evidential meaning.

## Provenance

Every evidence object extracted from a web source MUST retain the source id and canonical URL.

If a precise heading or DOM section locator is available, retain it.

The retrieval timestamp MUST remain visible in canonical state because web content may change.

## Source Independence

Multiple webpages repeating the same underlying report, press release, article, or dataset MUST NOT be counted as independent corroboration.

When shared lineage is detected, record the relationship and treat the items as one evidence lineage for corroboration purposes.

## Blog Posts

A blog post may contain useful evidence but MUST NOT receive elevated authority merely because it is polished or specific.

Separate:

* facts directly evidenced by the blog
* claims made by the author
* cited external sources
* interpretation

A citation inside a blog is not equivalent to possessing or verifying the cited source.

## Dynamic or Blocked Pages

If a page cannot expose meaningful readable text because of authentication, script only rendering, robots restrictions, or access controls:

* register the attempted source when useful
* mark extraction as failed or partial
* do not fabricate page content
* allow the user to upload the source as a file or paste the relevant material instead

## Temporal Integrity

For claims that may change over time, retrieval time and source publication or update date must remain separate fields.

A currently fetched old article is historical evidence, not automatically current evidence.
