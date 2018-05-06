'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

// this makes the expect syntax available throughout
// this module
const expect = chai.expect;

const { BlogPost } = require('../models');
const { app, runServer, closeServer } = require('../server');
const { TEST_DATABASE_URL } = require('../config');

chai.use(chaiHttp);

function seedBlogPostData() {
    console.info('seeding post data');
    const seedData = [];

    for (let i = 1; i <= 10; i++) {
        seedData.push(generateBlogPostData());
    }
    // this will return a promise
    return BlogPost.insertMany(seedData);
}

// used to generate data to put in db
function generateTitle() {
    const titles = [
        'When enogh is enough', 'Beyonfd the sea', 'Running on empty', 'Building a better auto'
    ];
    return titles[Math.floor(Math.random() * titles.length)];
}

// used to generate data to put in db
function generateContent() {
    const content = ['Some content 1', 'Some content 2', 'Sme content 3'];
    return content[Math.floor(Math.random() * content.length)];
}

// used to generate data to put in db
function generateAuthorFirstNmae() {
    const firstNames = ['Bob', 'Stan', 'Susanne', 'Bonny'];
    return firstNames[Math.floor(Math.random() * firstNames.length)];
};


// used to generate data to put in db
function generateAuthorLastNmae() {
    const lasttNames = ['Smith', 'Robinson', 'Blando', 'Griffin'];
    return lastNames[Math.floor(Math.random() * lastNames.length)];
};


// generate an object represnting a post.
// can be used to generate seed data for db
// or request.body data
function generateBlogPostData() {
    return {
        title: generateTitle(),
        content: generateContent(),
        author: {
            firstName: generateFirstName(),
            lastName: generateLastName()
        },
    };
}

// this function deletes the entire database.
// we'll call it in an `afterEach` block below
// to ensure data from one test does not stick
// around for next one
function tearDownDb() {
    console.warn('Deleting database');
    return mongoose.connection.dropDatabase();
}

describe('BlogPost API resource', function() {

    before(function() {
        return runServer(TEST_DATABASE_URL);
    });

    beforeEach(function() {
        return seedBlogPostData();
    });

    afterEach(function() {
        return tearDownDb();
    });

    after(function() {
        return closeServer();
    });


    describe('GET endpoint', function() {

        it('should return all existing posts', function() {
            // strategy:
            //    1. get back all postss returned by by GET request to `/posts`
            //    2. prove res has right status, data type
            //    3. prove the number of postss we got back is equal to number
            //       in db.
            //
            // need to have access to mutate and access `res` across
            // `.then()` calls below, so declare it here so can modify in place
            let res;
            return chai.request(app)
                .get('/posts')
                .then(function(_res) {
                    // so subsequent .then blocks can access response object
                    res = _res;
                    expect(res).to.have.status(200);
                    // otherwise our db seeding didn't work
                    expect(res.body.posts).to.have.lengthOf.at.least(1);
                    return BlogPost.count();
                })
                .then(function(count) {
                    expect(res.body.posts).to.have.lengthOf(count);
                });
        });


        it('should return posts with right fields', function() {
            // Strategy: Get back all posts, and ensure they have expected keys

            let resPost;
            return chai.request(app)
                .get('/posts')
                .then(function(res) {
                    expect(res).to.have.status(200);
                    expect(res).to.be.json;
                    expect(res.body.posts).to.be.a('array');
                    expect(res.body.posts).to.have.lengthOf.at.least(1);

                    res.body.posts.forEach(function(post) {
                        expect(post).to.be.a('object');
                        expect(post).to.include.keys(
                            'id', 'title', 'content', 'author', 'created');
                    });
                    resPost = res.body.posts[0];
                    return BlogPost.findById(resPost.id);
                })
                .then(function(post) {

                    expect(resPost.title).to.equal(post.title);
                    expect(resPost.content).to.equal(post.content);
                    expect(resPost.author).to.equal(post.authorName);
                });
        });
    });

    describe('POST endpoint', function() {
        // strategy: make a POST request with data,
        // then prove that the post we get back has
        // right keys, and that `id` is there (which means
        // the data was inserted into db)
        it('should add a new post', function() {

            const newPost = generatePostData();
            let mostRecentGrade;

            return chai.request(app)
                .post('/posts')
                .send(newPostt)
                .then(function(res) {
                    expect(res).to.have.status(201);
                    expect(res).to.be.json;
                    expect(res.body).to.be.a('object');
                    expect(res.body).to.include.keys(
                        'id', 'title', 'content', 'author', 'created');
                    expect(res.body.title).to.equal(newPost.title);
                    // cause Mongo should have created id on insertion
                    expect(res.body.id).to.not.be.null;
                    expect(res.body.author).to.equal(`${newPost.author.firstName} ${newPost.author.lastName}`);
                    expect(res.body.content).to.equal(newPost.content);

                    return BlogPost.findById(res.body.id);
                })
                .then(function(post) {
                    expect(post.title).to.equal(newPost.title);
                    expect(post.content).to.equal(newPost.content);
                    expect((`${post.author.firstName} ${post.author.lastName}`)).to.equal(`${newPost.author.firstName} ${newPost.author.lastName}`);
                });
        });
    });

    describe('PUT endpoint', function() {

        // strategy:
        //  1. Get an existing post from db
        //  2. Make a PUT request to update that post
        //  3. Prove post returned by request contains data we sent
        //  4. Prove post in db is correctly updated
        it('should update fields you send over', function() {
            const updateData = {
                title: 'There and Baack Again',
                content: 'A hobbits tale.',
                author: {
                    firstName: 'Bilbo',
                    lastName: 'Baggins'
                }
            };

            return BlogPost
                .findOne()
                .then(function(post) {
                    updateData.id = post.id;

                    // make request then inspect it to make sure it reflects
                    // data we sent
                    return chai.request(app)
                        .put(`/posts/${post.id}`)
                        .send(updateData);
                })
                .then(function(res) {
                    expect(res).to.have.status(204);

                    return BlogPost.findById(updateData.id);
                })
                .then(function(postt) {
                    expect(post.title).to.equal(updateData.title);
                    expect(post.content).to.equal(updateData.content);
                    expect(`${post.author.firstName} ${post.author.lastName}`).to.equal(`${updateData.author.firstName} ${updateData.author.lastName}`);
                });
        });
    });

    describe('DELETE endpoint', function() {
        // strategy:
        //  1. get a post
        //  2. make a DELETE request for that post's id
        //  3. assert that response has right status code
        //  4. prove that post with the id doesn't exist in db anymore
        it('deletes a post by id', function() {

            let post;

            return BlogPost
                .findOne()
                .then(function(_post) {
                    post = _post;
                    return chai.request(app).delete(`/posts/${post.id}`);
                })
                .then(function(res) {
                    expect(res).to.have.status(204);
                    return BlogPost.findById(post.id);
                })
                .then(function(_post) {
                    expect(_post).to.be.null;
                });
        });
    });
});