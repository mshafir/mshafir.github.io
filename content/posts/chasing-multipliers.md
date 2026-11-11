---
title: Chasing Multipliers
date: 2026-11-11
description: ""
tags: []
---

Wanted to put together some quick thoughts I've been having lately about LLMs and the 10x or 100x engineer. I've often thought of myself as a 10x engineer had you asked last year and now I'm just not sure. I don't know what velocity anybody is going at because all the metrics are different now and the goalposts haven't just moved, they've changed so we're playing a new sport.

My Dad loves to tell a story of his first job after moving to the US from the USSR. He and his fellow buddies (who were all engineers in the Soviet Union) had the night shift assembling some kind fireplace door (don't remember all the details). The process was very manual and involved carefully lining up several pieces before screwing them together and so it was quite cumbersome.

He and his buddies quickly figured out a frame they could put together from some old boards to line up the whole piece and make it much faster to assemble the doors. Since it was late and nobody else was around, they'd just use their frame, do a night's worth of work quickly, hide the frame in the closet, and then play cards and drink for the rest of the shift.

Naturally, some of the day workers found out and ratted them out saying those guys are just goofing off all night. The boss came one night and saw them playing cards while the work was all done and asked to see how. They showed him the frame thinking they'd lose their jobs.

Instead he gave them all raises.

Now my Dad loves embellishing stories (to say it lightly) but I keep coming back to that in my life thinking how can you take the tasks in front of you and not just solve them, but make systems to solve them faster or better.

I was listening to the [Pragmatic Engineer podcast episode with Titus Winters](https://newsletter.pragmaticengineer.com/p/software-engineering-at-google-and) and he talks about the 4th form of impact in tech being "changing the game" making things that previous would have been impossible or completely impractical. AI has done that in ways that open up stuff we would have never even tried to do. The gains from just regular doing the same thing but with AI is maybe a few times faster, but the real gains are to be had from those projects that are now reasonable that previously would have been crazy to even consider.

One place I'm seeing this is in personal productivity harnesses. Everybody can make themselves the perfect one-stop-shop app for their daily work. No 2 people have the same workflow so it never made sense to overfit to this degree but now you can get your perfect daily driver. This has shown up in my work a lot lately so I'll share a few examples.

### Stillbreaker Fitness RPG

For the [Stillbreaker](https://stillbreaker.com) fitness game I've been working on I asked claude to make me a bunch of internal review and dev tools as we went. Most of these took only a matter of minutes to spin up and came out pretty decent.

![Storyboard Review for My Game](/images/chasing-multipliers/image-2.png)

Storyboard Refinement

![](/images/chasing-multipliers/image-3.png)

Map Editor (claude built most of the maps, but I could adjust them and fix up mistakes)

![](/images/chasing-multipliers/image-4.png)

Battle Progression

And there's an art picker, tons of prototypes, a camera trainer app for the detection moves (Move Lab).

Really each of these surfaces is way better than what I could have iterated on within claude code alone so you quickly move to bespoke surfaces for each kind of refinement. Letting me get to just the right feel for my game.

For ongoing development it made an awesome published devlog so I could share the progress of this and related games as I work on them [https://stillbreaker.com/realms/devlog/.](https://stillbreaker.com/realms/devlog/) I ask for devlog sites almost all the time as I work on large new projects because it gives me a higher-level visual history of what claude has been doing so I can steer without reading the session transcript.

### This Blog

In About 15mins opus gave me a great desktop app for authoring this blog

![](/images/chasing-multipliers/image-5.png)

### My Day Job

Can't share much in the way of screenshots, but just built an awesome personal tool for my day job that take slack, gitlab, jira, all my claude code sessions, all my iniatives and ideas, and our team KPIs and puts them inside one super ambitious app that let's me track all my arch initiatives all the way through idea to RFC and team buy-in, to cases, and depoyment and rollout and measurement back to the KPIs. It's really changed the way I do my work and deliver. I never have to go to the jira or gitlab UI again, I have the view I've always wanted.

![](/images/chasing-multipliers/image-6.png)

Oh and a great feature here is the note icon in the corner, I can just click it and comment on any part of the live app to ask claude to make changes/improvements on the fly. That only works because it's my personal app.

So are you going to keep building doors by hand? or are you going to build something to make yourself more productive? And what will you do with the time left over?
