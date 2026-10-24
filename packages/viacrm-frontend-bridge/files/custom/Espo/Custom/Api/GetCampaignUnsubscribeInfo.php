<?php

namespace Espo\Custom\Api;

use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Api\ResponseComposer;
use Espo\Core\Exceptions\BadRequest;
use Espo\Modules\Crm\Tools\MassEmail\UnsubscribeService;

class GetCampaignUnsubscribeInfo implements Action
{
    public function __construct(
        private UnsubscribeService $unsubscribeService,
    ) {}

    public function process(Request $request): Response
    {
        $id = $request->getRouteParam('id');
        $emailAddress = $request->getRouteParam('emailAddress');
        $hash = $request->getRouteParam('hash');

        if ($emailAddress && $hash) {
            $isSubscribed = $this->unsubscribeService->isSubscribedWithHash($emailAddress, $hash);
        } elseif ($id) {
            $isSubscribed = $this->unsubscribeService->isSubscribed($id);
        } else {
            throw new BadRequest();
        }

        return ResponseComposer::json(['isSubscribed' => $isSubscribed]);
    }
}
