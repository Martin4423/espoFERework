<?php

namespace Espo\Custom\Api;

use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Api\ResponseComposer;
use Espo\Core\Exceptions\BadRequest;
use Espo\Core\Exceptions\Error;
use Espo\Core\Name\Field;
use Espo\Core\ORM\EntityManager;
use Espo\Core\HookManager;
use Espo\Core\Utils\Language;
use Espo\Core\Utils\Metadata;
use Espo\Entities\Note;
use Espo\Entities\UniqueId;
use Espo\Entities\User;
use Espo\Modules\Crm\Entities\Meeting;
use Espo\ORM\Entity;

class GetEventConfirmation implements Action
{
    private const ACTION_LIST = ['accept', 'decline', 'tentative'];
    private const STATUS_MAP = [
        'accept' => Meeting::ATTENDEE_STATUS_ACCEPTED,
        'decline' => Meeting::ATTENDEE_STATUS_DECLINED,
        'tentative' => Meeting::ATTENDEE_STATUS_TENTATIVE,
    ];

    public function __construct(
        private EntityManager $entityManager,
        private HookManager $hookManager,
        private Metadata $metadata,
        private Language $language,
    ) {}

    public function process(Request $request): Response
    {
        $uid = $request->getRouteParam('uid') ?? throw new BadRequest('No uid.');
        $action = $request->getRouteParam('action') ?? throw new BadRequest('No action.');

        if (!in_array($action, self::ACTION_LIST, true)) {
            throw new BadRequest('Bad action.');
        }

        /** @var ?UniqueId $uniqueId */
        $uniqueId = $this->entityManager->getRDBRepositoryByClass(UniqueId::class)
            ->where(['name' => $uid])
            ->findOne();

        if (!$uniqueId) {
            throw new BadRequest('Confirmation link not found.');
        }

        $data = $uniqueId->getData();
        $eventType = $data->eventType ?? null;
        $eventId = $data->eventId ?? null;
        $inviteeType = $data->inviteeType ?? null;
        $inviteeId = $data->inviteeId ?? null;
        $link = $data->link ?? null;
        $sentDateStart = $data->dateStart ?? null;

        if (!$eventType || !$eventId || !$inviteeType || !$inviteeId || !$link) {
            throw new Error('Bad event confirmation data.');
        }

        if ($sentDateStart !== null && !is_string($sentDateStart)) {
            throw new Error('Invalid event confirmation date.');
        }

        $event = $this->entityManager->getEntityById($eventType, $eventId);
        $invitee = $this->entityManager->getEntityById($inviteeType, $inviteeId);

        if (!$event || !$invitee) {
            throw new Error('Event or invitee not found.');
        }

        $relation = $this->entityManager->getRDBRepository($eventType)->getRelation($event, $link);
        $isRelated = $relation->isRelated($invitee);
        $eventStatus = $isRelated ? $event->get('status') : Meeting::STATUS_NOT_HELD;
        $eventName = $event->get(Field::NAME);
        $translatedEntityType = $this->language->translateLabel($eventType, 'scopeNames');

        if (in_array($eventStatus, [Meeting::STATUS_HELD, Meeting::STATUS_NOT_HELD], true)) {
            return ResponseComposer::json([
                'status' => 'final',
                'eventName' => $eventName,
                'translatedEntityType' => $translatedEntityType,
                'translatedStatus' => $this->language->translateOption($eventStatus, 'status', $eventType),
                'style' => $this->metadata->get(['entityDefs', $eventType, 'fields', 'status', 'style', $eventStatus]),
            ]);
        }

        $status = self::STATUS_MAP[$action];
        $actionData = [
            'eventName' => $eventName,
            'eventType' => $event->getEntityType(),
            'eventId' => $event->getId(),
            'dateStart' => $event->get('dateStart'),
            'action' => $action,
            'status' => $status,
            'link' => $link,
            'inviteeType' => $invitee->getEntityType(),
            'inviteeId' => $invitee->getId(),
        ];

        $currentStatus = $relation->getColumn($invitee, 'status');

        if ($currentStatus !== $status) {
            $relation->updateColumns($invitee, ['status' => $status]);

            if ($this->metadata->get(['scopes', $eventType, 'stream'])) {
                $this->createNote($event, $invitee, $status);
            }

            $this->hookManager->process($event->getEntityType(), 'afterConfirmation', $event, [], $actionData);
        }

        $statusTranslation = $this->language->get([Meeting::ENTITY_TYPE, 'options', 'acceptanceStatus']);

        return ResponseComposer::json([
            ...$actionData,
            'status' => 'confirmed',
            'attendeeStatus' => $status,
            'translatedEntityType' => $translatedEntityType,
            'translatedStatus' => $this->language->translateOption($status, 'acceptanceStatus', $eventType),
            'style' => $this->metadata->get(['entityDefs', $eventType, 'fields', 'acceptanceStatus', 'style', $status]),
            'sentDateStart' => $sentDateStart,
            'statusTranslation' => $statusTranslation,
        ]);
    }

    private function createNote(Entity $entity, Entity $invitee, string $status): void
    {
        $options = $invitee->getEntityType() === User::ENTITY_TYPE ? ['createdById' => $invitee->getId()] : [];
        $style = $this->metadata->get(['entityDefs', $entity->getEntityType(), 'fields', 'acceptanceStatus', 'style', $status]);

        $this->entityManager->createEntity(Note::ENTITY_TYPE, [
            'type' => 'EventConfirmation',
            'parentId' => $entity->getId(),
            'parentType' => $entity->getEntityType(),
            'relatedId' => $invitee->getId(),
            'relatedType' => $invitee->getEntityType(),
            'data' => ['status' => $status, 'style' => $style],
        ], $options);
    }
}
