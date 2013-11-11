/*global chai, sinon, Port, handlers, currentConversation:true, UserData,
  _presenceSocket:true, browserPort:true, tkWorker, Conversation, SPA,
  spa:true, payloads */
/* jshint expr:true */

var expect = chai.expect;

describe('handlers', function() {
  var sandbox;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    sandbox.stub(window, "SPAPort");
    sandbox.stub(window, "Server");
    sandbox.stub(window, "Worker").returns({postMessage: sinon.spy()});
    spa = new SPA({src: "example.com"});
    browserPort = {postEvent: sandbox.spy()};
  });

  afterEach(function() {
    sandbox.restore();
    browserPort = undefined;
  });

  describe("social.port-closing", function() {
    var port;

    beforeEach(function() {
      port = new Port({_portid: 42});
      tkWorker.ports.add(port);
    });

    afterEach(function() {
      currentConversation = undefined;
    });

    it("should remove a closed port on receiving social.port-closing",
      function() {
        handlers['social.port-closing'].bind(port)();
        expect(Object.keys(tkWorker.ports.ports)).to.have.length.of(0);
      });

    it("should clear the current conversation on receiving " +
       "social.port-closing for the conversation port", function() {
        currentConversation = new Conversation();
        currentConversation.port = port;

        handlers['social.port-closing'].bind(port)();
        expect(currentConversation).to.be.equal(undefined);
      });
  });

  describe("talkilla.contacts", function() {
    it("should update contacts list with provided contacts", function() {
      sandbox.stub(tkWorker, "updateContactsFromSource");
      var contacts = [{username: "foo"}, {username: "bar"}];

      handlers['talkilla.contacts']({
        topic: "talkilla.contacts",
        data: {contacts: contacts, source: "google"}
      });

      sinon.assert.calledOnce(tkWorker.updateContactsFromSource);
      sinon.assert.calledWithExactly(tkWorker.updateContactsFromSource,
                                     contacts, "google");
    });
  });

  describe("talkilla.conversation-open", function() {
    afterEach(function() {
      currentConversation = undefined;
    });

    it("should create a new conversation object when receiving a " +
       "talkilla.conversation-open event", function() {
        handlers.postEvent = sinon.spy();
        handlers['talkilla.conversation-open']({
          topic: "talkilla.conversation-open",
          data: {}
        });

        expect(currentConversation).to.be.an.instanceOf(Conversation);
      });
  });

  describe("talkilla.chat-window-ready", function() {
    beforeEach(function() {
      tkWorker.user = new UserData();
      currentConversation = {
        windowOpened: sandbox.spy()
      };
    });

    afterEach(function() {
      currentConversation = undefined;
      tkWorker.user.reset();
    });

    it("should tell the conversation the window has opened when " +
      "receiving a talkilla.chat-window-ready",
      function () {
        var chatAppPort = {postEvent: sinon.spy()};
        tkWorker.user.name = "bob";

        handlers['talkilla.chat-window-ready'].bind(chatAppPort)({
          topic: "talkilla.chat-window-ready",
          data: {}
        });

        sinon.assert.called(currentConversation.windowOpened);
        sinon.assert.calledWithExactly(currentConversation.windowOpened,
          chatAppPort);
      });
  });

  describe("talkilla.sidebar-ready", function() {

    beforeEach(function() {
      tkWorker.user = new UserData();
      sandbox.stub(tkWorker.user, "send");
    });

    afterEach(function() {
      tkWorker.user.reset();
    });

    it("should notify new sidebars the worker is ready",
      function() {
        handlers.postEvent = sinon.spy();
        handlers['talkilla.sidebar-ready']({
          topic: "talkilla.sidebar-ready",
          data: {}
        });

        sinon.assert.calledOnce(handlers.postEvent);
        sinon.assert.calledWith(handlers.postEvent, "talkilla.worker-ready");
      });

  });

  describe("talkilla.spa-enable", function() {

    it("should instantiate a new SPA with the given src", function() {
      var spa = {connect: sinon.spy(), on: function() {}};
      sandbox.stub(window, "SPA").returns(spa);

      handlers["talkilla.spa-enable"]({
        data: {src: "/path/to/spa", credentials: "fake credentials"}
      });

      sinon.assert.calledOnce(SPA);
      sinon.assert.calledWithExactly(SPA, {src: "/path/to/spa"});
    });

    it("should connect the created SPA with given credentials", function() {
      var spa = {connect: sinon.spy(), on: function() {}};
      sandbox.stub(window, "SPA").returns(spa);

      handlers["talkilla.spa-enable"]({
        data: {src: "/path/to/spa", credentials: "fake credentials"}
      });

      sinon.assert.calledOnce(spa.connect);
      sinon.assert.calledWithExactly(spa.connect, "fake credentials");
    });

  });

  describe("talkilla.presence-request", function () {
    beforeEach(function() {
      tkWorker.user = new UserData();
      sandbox.stub(tkWorker.user, "send");
      sandbox.stub(spa, "presenceRequest");
    });

    afterEach(function() {
      tkWorker.user.reset();
    });

    it("should notify new sidebars of current users",
      function() {
        tkWorker.user.name = "jb";
        _presenceSocket = {send: sinon.spy()};
        tkWorker.users.reset();
        handlers.postEvent = sinon.spy();
        handlers['talkilla.presence-request']({
          topic: "talkilla.presence-request",
          data: {}
        });

        sinon.assert.calledWith(handlers.postEvent, "talkilla.users");
      });

    it("should request for the initial presence state " +
       "if there is no current users", function() {
        tkWorker.users.reset();
        handlers['talkilla.presence-request']({
          topic: "talkilla.presence-request",
          data: {}
        });

        sinon.assert.calledOnce(spa.presenceRequest);
      });

  });

  describe("talkilla.call-offer", function() {

    it("should send an offer when receiving a talkilla.call-offer event",
      function() {
        tkWorker.user.name = "tom";
        sandbox.stub(spa, "callOffer");
        var offerMsg = new payloads.Offer({
          peer: "tom",
          offer: { sdp: "sdp", type: "type" }
        });

        handlers['talkilla.call-offer']({
          topic: "talkilla.call-offer",
          data: offerMsg
        });

        sinon.assert.calledOnce(spa.callOffer);
        sinon.assert.calledWithExactly(spa.callOffer, offerMsg);
      });
  });

  describe("talkilla.call-answer", function() {
    it("should send a websocket message when receiving talkilla.call-answer",
      function() {
        tkWorker.user.name = "fred";
        sandbox.stub(spa, "callAnswer");
        var answerMsg = new payloads.Answer({
          answer: "fake answer",
          peer: "fred"
        });

        handlers['talkilla.call-answer']({
          topic: "talkilla.call-answer",
          data: answerMsg
        });

        sinon.assert.calledOnce(spa.callAnswer);
        sinon.assert.calledWithExactly(
          spa.callAnswer, answerMsg);
      });
  });

  describe("talkilla.call-hangup", function() {
    afterEach(function() {
      currentConversation = undefined;
    });

    it("should hangup the call when receiving talkilla.call-hangup",
      function() {
        var hangupMsg = new payloads.Hangup({peer: "florian"});
        tkWorker.user.name = "florian";
        sandbox.stub(spa, "callHangup");

        handlers['talkilla.call-hangup']({
          topic: "talkilla.call-hangup",
          data: hangupMsg.toJSON()
        });

        sinon.assert.calledOnce(spa.callHangup);
        sinon.assert.calledWithExactly(spa.callHangup, hangupMsg);
      });
  });

  describe("talkilla.ice-candidate", function() {
    afterEach(function() {
    });

    it("should pass the ice candidate to the spa",
      function() {
        sandbox.stub(spa, "iceCandidate");
        var iceCandidateMsg = new payloads.IceCandidate({
          peer: "lloyd",
          candidate: "dummy"
        });

        handlers['talkilla.ice-candidate']({
          topic: "talkilla.ice-candidate",
          data: iceCandidateMsg
        });

        sinon.assert.calledOnce(spa.iceCandidate);
        sinon.assert.calledWithExactly(spa.iceCandidate, iceCandidateMsg);
      });
  });

});
