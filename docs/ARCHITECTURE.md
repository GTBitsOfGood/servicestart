# ServiceStart Architecture

_As of June 2026_

This guide is intended to ease the handoff to the Fall 2026 ServiceStart EM. ServiceStart is a bit of a weird project, so I (Renato, the Spring 2026 EM) wanted to explain the key decisions I made and what they mean for you. If you have questions, hit me up on Slack under Renato Dell'Osso.

## Background: Voluntrack

ServiceStart is intended as a replacement to Voluntrack, Bits of Good's standard nonprofit management web app. Think event management, user tracking, and newsletters. To my knowledge, there are 5 nonprofits currently on Voluntrack, each with a branch of the GitHub repo. Customization for each nonprofit is done via these branches, by directly modifying the codebase. This direct modification means the codebase got fragmented and is frankly a mess. Also each nonprofit requires separate infrastructure.

## What is ServiceStart?

ServiceStart is a replacement for Voluntrack meant to alleviate Voluntrack's problems(codebase fragmentation, separate infrastructure, etc). We want a nonprofit management platform that allows for easy deployments and customization while still using a single codebase and one set of infrastructure. Put simply, multitenancy.

The project lies somewhere on the spectrum between "single app" and "component library." ServiceStart is certainly in the middle, but exactly where is debatable. We want future BoG teams to use ServiceStart to make a wide array of applications. However, ServiceStart cannot handle every possible BoG project, nor should it. You wouldn't build ICAN with ServiceStart, for example. Handling every possible project would require us to avoid making opinionated choices and come at the cost of doing those projects well. In my opinion, it's better for us to target certain types of projects (namely projects heavy on data management, editing, and presentation) and have strong opinions about how those projects should be built.

## How is Multitenancy Implemented?

Each nonprofit or ServiceStart deployment has a row in the `Organizations` table. This row is the central hub for everything in that deployment. To users, these deployments should be totally separate; a ServiceStart app should be indistinguishable from a non-ServiceStart app except for a "Made with ServiceStart" in the footer. To this end, we've modified BetterAuth's behavior to allow one username to be used across multiple organizations.

App customization is done through "organization configurations," chiefly in the `OrganizationConfig` table. There are a variety of options implemented in ServiceStart. Each comes with a default setting, but an `OrganizationConfig` row can be created to override that setting for the specified organization. These settings are cached on the client to speed up non-SSRed pages.

Now, suppose nonprofit A wants a new feature for their ServiceStart app. You'd build this feature as though it existed for every nonprofit, but then add a new option to enable/disable this feature, defaulting it to disabled. Then, you'd create a row in the production DB to enable the feature for nonprofit A. This implementation does mean that technically every nonprofit has some data for most features, but just can't access it.

Suppose that later nonprofit B wants a similar feature. Ordinarily, you'd have to build the feature from scratch despite its similarities to nonprofit A's feature. With ServiceStart, however, you simply add a config option and use that option to determine which version of the feature to present to users. You only have to code the differences between the two features.

Side note: Check whether features are enabled on the relevant API routes. If the user directory is disabled, that feature's API routes should also be disabled.

## Future Work

There's still lots to be done on core ServiceStart (as opposed to individual deployments). Currently, the color is only customizable on the login/signup pages and file storage still needs the finishing touches put on. See the GitHub Issues for more.

When building individual projects with ServiceStart, focus on "how can we extend ServiceStart to handle our project out-of-the-box?" rather than "how can we build our project starting with ServiceStart." Basically, we want a robust and expansive ServiceStart, not a bunch of siloed projects all originating from the same codebase.
